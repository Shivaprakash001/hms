import { prisma } from "@/lib/db";
import { eventLog } from "@/lib/services/event-log-service";
import { AgreementGenerationService, DEFAULT_RULE_CONTENT } from "./agreement-generation-service";
import { AGREEMENT_ACTIVITY_EVENTS, isCurrentAgreementStatus } from "./agreement-status";
import { assertAgreementLifecycleComplete } from "./agreement-lifecycle-completeness";
import { getActiveTemplateAndSyncRuleVersion, DEFAULT_RULES_TEMPLATE, interpolateRulesContent } from "../../utils/default-rules";

type AgreementRenewalSigningErrorCode =
  | "RENEWAL_AGREEMENT_NOT_FOUND"
  | "RENEWAL_DRAFT_REQUIRED"
  | "PREDECESSOR_AGREEMENT_NOT_FOUND"
  | "PREDECESSOR_NOT_RENEWABLE"
  | "INVALID_RENEWAL_CHAIN"
  | "MOVE_OUT_IN_PROGRESS"
  | "SIGNATURE_REQUIRED"
  | "AGREEMENT_LIFECYCLE_INCOMPLETE";

type SignatureInput = {
  signature_url?: string | null;
  signature_name?: string | null;
};

type RenewalSigningInput = {
  renewalAgreementId: string;
  tenantSignature: SignatureInput;
  guardianSignature?: (SignatureInput & { relation?: string | null }) | null;
  signedBy?: string | null;
  metadata?: {
    ip?: string | null;
    userAgent?: string | null;
  };
};

type RenewalSigningResult = {
  predecessorAgreement: any;
  renewalAgreement: any;
  pdfUrl: string | null;
  pdfGenerated: boolean;
  pdfError?: string;
};

function cleanString(value: unknown) {
  const str = String(value || "").trim();
  return str || null;
}

export class AgreementRenewalSigningError extends Error {
  code: AgreementRenewalSigningErrorCode;
  status = 409;
  details?: Record<string, unknown>;

  constructor(code: AgreementRenewalSigningErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AgreementRenewalSigningError";
    this.code = code;
    this.details = details;
  }
}

export class AgreementRenewalSigningService {
  constructor(
    private readonly db = prisma,
    private readonly pdfGenerator = AgreementGenerationService,
    private readonly activityLog = eventLog
  ) {}

  async signRenewalAgreement(input: RenewalSigningInput): Promise<RenewalSigningResult> {
    const renewalAgreementId = cleanString(input.renewalAgreementId);
    if (!renewalAgreementId) {
      throw new AgreementRenewalSigningError("RENEWAL_AGREEMENT_NOT_FOUND", "Renewal agreement not found");
    }

    const tenantSignatureUrl = cleanString(input.tenantSignature?.signature_url);
    const tenantSignatureName = cleanString(input.tenantSignature?.signature_name);
    const guardianSignatureUrl = cleanString(input.guardianSignature?.signature_url);
    const guardianSignatureName = cleanString(input.guardianSignature?.signature_name);
    const guardianRelation = cleanString(input.guardianSignature?.relation);
    const hasGuardianSignature = Boolean(guardianSignatureUrl || guardianSignatureName || guardianRelation);

    if (!tenantSignatureUrl || !tenantSignatureName) {
      throw new AgreementRenewalSigningError("SIGNATURE_REQUIRED", "Tenant signature is required", {
        renewalAgreementId,
      });
    }
    if (hasGuardianSignature && (!guardianSignatureUrl || !guardianSignatureName || !guardianRelation)) {
      throw new AgreementRenewalSigningError("SIGNATURE_REQUIRED", "Complete guardian signature is required", {
        renewalAgreementId,
      });
    }

    const now = new Date();
    const signed = await this.db.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM "Agreement" WHERE id = ${renewalAgreementId}::uuid FOR UPDATE`;

      const renewalAgreement = await tx.agreement.findUnique({
        where: { id: renewalAgreementId },
        include: {
          template: true,
          tenant: {
            select: {
              id: true,
              owner_id: true,
              hostel_id: true,
              profiles: {
                select: {
                  name: true,
                },
              },
              hostels: {
                select: {
                  name: true,
                },
              },
            },
          },
          renewed_from_agreement: true,
        },
      });

      if (!renewalAgreement) {
        throw new AgreementRenewalSigningError("RENEWAL_AGREEMENT_NOT_FOUND", "Renewal agreement not found", {
          renewalAgreementId,
        });
      }
      if (renewalAgreement.status !== "DRAFT") {
        throw new AgreementRenewalSigningError("RENEWAL_DRAFT_REQUIRED", "Renewal agreement must be in DRAFT status", {
          renewalAgreementId,
          status: renewalAgreement.status,
        });
      }
      if (!renewalAgreement.renewed_from_agreement_id || !renewalAgreement.renewed_from_agreement) {
        throw new AgreementRenewalSigningError(
          "PREDECESSOR_AGREEMENT_NOT_FOUND",
          "Predecessor agreement not found",
          { renewalAgreementId }
        );
      }

      const predecessor = renewalAgreement.renewed_from_agreement;
      await tx.$queryRaw`SELECT id FROM "Agreement" WHERE id = ${predecessor.id}::uuid FOR UPDATE`;

      if (!isCurrentAgreementStatus(predecessor.status)) {
        throw new AgreementRenewalSigningError(
          "PREDECESSOR_NOT_RENEWABLE",
          "Predecessor agreement is not eligible for renewal signing",
          {
            predecessorAgreementId: predecessor.id,
            predecessorStatus: predecessor.status,
          }
        );
      }

      if (predecessor.renewed_to_agreement_id !== renewalAgreement.id) {
        throw new AgreementRenewalSigningError("INVALID_RENEWAL_CHAIN", "Renewal chain is invalid", {
          predecessorAgreementId: predecessor.id,
          predecessorRenewedToAgreementId: predecessor.renewed_to_agreement_id,
          renewalAgreementId: renewalAgreement.id,
        });
      }

      try {
        assertAgreementLifecycleComplete(renewalAgreement, { agreementId: renewalAgreement.id });
      } catch (error: any) {
        throw new AgreementRenewalSigningError(
          "AGREEMENT_LIFECYCLE_INCOMPLETE",
          error?.message || "Agreement lifecycle metadata is incomplete",
          error?.details || { renewalAgreementId: renewalAgreement.id }
        );
      }

      const activeMoveOut = await tx.move_out_requests.findFirst({
        where: {
          tenant_id: renewalAgreement.tenant_id,
          status: { notIn: ["COMPLETED", "REJECTED"] },
        },
        select: { id: true, status: true },
        orderBy: { created_at: "desc" },
      });
      if (activeMoveOut) {
        throw new AgreementRenewalSigningError(
          "MOVE_OUT_IN_PROGRESS",
          "Move-out already in progress. Cancel move-out before renewing.",
          {
            tenantId: renewalAgreement.tenant_id,
            moveOutRequestId: activeMoveOut.id,
            moveOutStatus: activeMoveOut.status,
          }
        );
      }

      const predecessorUpdate = await tx.agreement.updateMany({
        where: {
          id: predecessor.id,
          status: { in: ["SIGNED", "EXPIRING_SOON", "AGREEMENT_EXPIRED"] },
          renewed_to_agreement_id: renewalAgreement.id,
        },
        data: {
          status: "RENEWED",
          renewed_at: now,
        },
      });
      if (predecessorUpdate.count !== 1) {
        throw new AgreementRenewalSigningError("INVALID_RENEWAL_CHAIN", "Renewal chain changed during signing", {
          predecessorAgreementId: predecessor.id,
          renewalAgreementId: renewalAgreement.id,
        });
      }

      // Fetch active template and sync rule version
      const template = await getActiveTemplateAndSyncRuleVersion(tx, renewalAgreement.tenant.hostel_id, "RENEWAL");
      const ruleVersion = await tx.ruleVersion.findUnique({
        where: { id: template.id },
      });

      const roomNo = (renewalAgreement.content_snapshot as any)?.room_number || "N/A";
      const tenantName = renewalAgreement.tenant.profiles?.name || "Tenant";

      const variables = {
        TENANT_NAME: tenantName,
        ROOM_NUMBER: roomNo,
        MONTHLY_RENT: Number(renewalAgreement.contract_rent ?? 0),
        SECURITY_DEPOSIT_AMOUNT: Number(renewalAgreement.contract_security_deposit ?? 0),
        MAINTENANCE_CHARGE_AMOUNT: Number(renewalAgreement.contract_maintenance ?? 0),
        HOSTEL_NAME: renewalAgreement.tenant.hostels?.name || "Hostel",
        OWNER_NAME: template.owner_name,
        JOINING_DATE: (renewalAgreement.content_snapshot as any)?.joining_date || "",
      };

      const rawRules = template.rules_content || DEFAULT_RULES_TEMPLATE;
      const interpolatedRules = interpolateRulesContent(rawRules, variables, true);

      const rulesSnapshot = ruleVersion
        ? (ruleVersion.content || ruleVersion.content_snapshot || rawRules)
        : rawRules;

      const ruleVersionId = ruleVersion?.id || template.id;
      const ruleVersionNumber = ruleVersion?.version || `v${template.version_number}`;

      const renewalUpdate = await tx.agreement.updateMany({
        where: {
          id: renewalAgreement.id,
          status: "DRAFT",
          renewed_from_agreement_id: predecessor.id,
        },
        data: {
          status: "SIGNED",
          signed_at: now,
          tenant_signature_url: tenantSignatureUrl,
          tenant_signature_name: tenantSignatureName,
          tenant_signed_at: now,
          tenant_ip: input.metadata?.ip || null,
          tenant_user_agent: input.metadata?.userAgent || null,
          guardian_signature_url: hasGuardianSignature ? guardianSignatureUrl : null,
          guardian_signature_name: hasGuardianSignature ? guardianSignatureName : null,
          guardian_relation: hasGuardianSignature ? guardianRelation : null,
          guardian_signed_at: hasGuardianSignature ? now : null,
          guardian_ip: hasGuardianSignature ? input.metadata?.ip || null : null,
          guardian_user_agent: hasGuardianSignature ? input.metadata?.userAgent || null : null,
          owner_signature_url: template.owner_signature_url || renewalAgreement.template?.owner_signature_url || null,
          owner_signature_name: template.owner_name || renewalAgreement.template?.owner_name || null,
          owner_signed_at: now,
          rules_snapshot: rulesSnapshot,
          rule_version_id: ruleVersionId,
          rule_version_number: ruleVersionNumber,
          content_snapshot: {
            ...(renewalAgreement.content_snapshot as any || {}),
            template_id: template.id,
            template_version_number: template.version_number,
            template_published_at: template.published_at,
            template_name: template.title,
            template_type: template.type,
            raw_rules: rawRules,
            interpolated_rules: interpolatedRules,
            hostel_rules: interpolatedRules,
          },
        },
      });
      if (renewalUpdate.count !== 1) {
        throw new AgreementRenewalSigningError("RENEWAL_DRAFT_REQUIRED", "Renewal agreement changed during signing", {
          renewalAgreementId: renewalAgreement.id,
        });
      }

      const signedRenewal = await tx.agreement.findUnique({
        where: { id: renewalAgreement.id },
        include: { template: true },
      });
      const renewedPredecessor = await tx.agreement.findUnique({
        where: { id: predecessor.id },
      });

      return {
        predecessorAgreement: renewedPredecessor,
        renewalAgreement: signedRenewal,
        tenantOwnerId: renewalAgreement.tenant?.owner_id || null,
        tenantId: renewalAgreement.tenant_id,
      };
    });

    let pdfUrl: string | null = null;
    let pdfGenerated = false;
    let pdfError: string | undefined;
    try {
      pdfUrl = await this.pdfGenerator.generateAndUploadPdf(renewalAgreementId);
      pdfGenerated = true;
      if (signed.renewalAgreement) {
        signed.renewalAgreement.pdf_url = pdfUrl;
      }
    } catch (error: any) {
      pdfError = String(error?.message || error);
    }

    await this.activityLog.log(
      AGREEMENT_ACTIVITY_EVENTS.RENEWED,
      signed.tenantOwnerId,
      {
        tenant_id: signed.tenantId,
        old_agreement_id: signed.predecessorAgreement?.id,
        new_agreement_id: signed.renewalAgreement?.id,
        signed_by: input.signedBy || "TENANT",
        renewed_at: now.toISOString(),
        pdf_generated: pdfGenerated,
        ...(pdfError ? { pdf_error: pdfError } : {}),
      },
      signed.tenantId
    );

    return {
      predecessorAgreement: signed.predecessorAgreement,
      renewalAgreement: signed.renewalAgreement,
      pdfUrl,
      pdfGenerated,
      ...(pdfError ? { pdfError } : {}),
    };
  }
}

export const agreementRenewalSigningService = new AgreementRenewalSigningService();

export async function signRenewalAgreement(input: RenewalSigningInput) {
  return agreementRenewalSigningService.signRenewalAgreement(input);
}

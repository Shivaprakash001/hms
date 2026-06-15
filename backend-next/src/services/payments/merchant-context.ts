import { prisma } from "@/lib/db";
import { PAYMENT_DOMAIN, PAYMENT_FLOW, PAYMENT_SCOPE, MERCHANT_CONTEXT } from "./financial-domain";
import { resolvePhonePeEnvironment } from "./phonepe-env";
import { backendUrl, getBackendUrl } from "@/lib/config/domains";


type MaybeHostelId = string | null;

export async function getProviderContext(params: {
  paymentDomain: string;
  flowType: string;
  operationalOwnerId: string;
  financialOwnerId?: string | null;
  hostelId?: MaybeHostelId;
  scopeType: string;
}) {
  const {
    paymentDomain,
    flowType,
    operationalOwnerId,
    financialOwnerId,
    hostelId,
    scopeType,
  } = params;

  if (paymentDomain === PAYMENT_DOMAIN.PLATFORM_BILLING) {
    if (!process.env.PHONEPE_CLIENT_ID || !process.env.PHONEPE_CLIENT_SECRET) {
      throw new Error("CONFIG_ERROR: HMS platform PhonePe credentials are not configured");
    }
    return {
      provider: "PHONEPE",
      payment_domain: PAYMENT_DOMAIN.PLATFORM_BILLING,
      flow_type: flowType,
      scope_type: PAYMENT_SCOPE.PLATFORM,
      merchant_context_type: MERCHANT_CONTEXT.HMS_PLATFORM,
      merchant_context_id: MERCHANT_CONTEXT.HMS_PLATFORM,
      operational_owner_id: operationalOwnerId,
      financial_owner_id: financialOwnerId || process.env.HMS_FINANCIAL_OWNER_ID || null,
      hostel_id: null,
      config: {
        clientId: process.env.PHONEPE_CLIENT_ID || "",
        clientSecret: process.env.PHONEPE_CLIENT_SECRET || "",
        clientVersion: process.env.PHONEPE_CLIENT_VERSION || "1",
        merchantId: process.env.PHONEPE_MERCHANT_ID || "",
        saltKey: process.env.PHONEPE_SALT_KEY || "",
        saltIndex: process.env.PHONEPE_SALT_INDEX || "",
        environment: resolvePhonePeEnvironment(),
        callbackUrl: backendUrl("/api/webhooks/payments/phonepe"),
      },
    };
  }

  if (paymentDomain !== PAYMENT_DOMAIN.RENT_COLLECTION) {
    throw new Error(`UNSUPPORTED_PAYMENT_DOMAIN: ${paymentDomain}`);
  }
  if (scopeType !== PAYMENT_SCOPE.HOSTEL) {
    throw new Error("HOSTEL_CONTEXT_REQUIRED: rent collection provider routing requires HOSTEL scope");
  }
  if (!hostelId) {
    throw new Error("HOSTEL_CONTEXT_REQUIRED: hostelId is required for rent collection provider routing");
  }

  const hostel = await prisma.hostels.findUnique({
    where: { id: hostelId },
    include: { profiles: true },
  });

  if (!hostel || hostel.owner_id !== operationalOwnerId) {
    throw new Error("HOSTEL_ACCESS_DENIED: Payment provider hostel does not belong to this owner.");
  }

  if (![PAYMENT_FLOW.RENT, PAYMENT_FLOW.FUTURE_RENT_CREDIT, PAYMENT_FLOW.SECURITY_DEPOSIT, "ADVANCE", "DEPOSIT", PAYMENT_FLOW.MANUAL_UPI_REFERENCE].includes(flowType as any)) {
    throw new Error(`UNSUPPORTED_RENT_COLLECTION_FLOW: ${flowType}`);
  }

  if ([PAYMENT_FLOW.RENT, PAYMENT_FLOW.FUTURE_RENT_CREDIT, PAYMENT_FLOW.SECURITY_DEPOSIT, "ADVANCE", "DEPOSIT"].includes(flowType as any)) {
    if (!process.env.PHONEPE_CLIENT_ID || !process.env.PHONEPE_CLIENT_SECRET) {
      throw new Error("CONFIG_ERROR: HMS treasury PhonePe credentials are not configured");
    }

    const resolvedEnv = resolvePhonePeEnvironment();
    const isProduction = resolvedEnv === "production";
    console.info("[merchant-context] HMS_TREASURY context resolved", {
      payment_domain:           PAYMENT_DOMAIN.RENT_COLLECTION,
      merchant_context_type:    MERCHANT_CONTEXT.HMS_TREASURY,
      flow_type:                flowType,
      hostel_id:                hostelId,
      operational_owner_id:     operationalOwnerId,
      environment:              resolvedEnv,
      is_production_mode:       isProduction,
      // Credentials presence (never log values)
      PHONEPE_CLIENT_ID_set:    Boolean(process.env.PHONEPE_CLIENT_ID),
      PHONEPE_CLIENT_ID_suffix: process.env.PHONEPE_CLIENT_ID?.slice(-4) ?? null,
      PHONEPE_CLIENT_VERSION:   process.env.PHONEPE_CLIENT_VERSION ?? "(not set — will default to 1)",
      PHONEPE_MERCHANT_ID_set:  Boolean(process.env.PHONEPE_MERCHANT_ID),
      backend_url:              getBackendUrl(),
      oauth_url_will_be:        isProduction
        ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
      checkout_url_will_be:     isProduction
        ? "https://api.phonepe.com/apis/pg/checkout/v2/pay"
        : "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
    });

    return {
      provider: "PHONEPE",
      payment_domain: PAYMENT_DOMAIN.RENT_COLLECTION,
      flow_type: flowType,
      scope_type: PAYMENT_SCOPE.HOSTEL,
      merchant_context_type: MERCHANT_CONTEXT.HMS_TREASURY,
      merchant_context_id: MERCHANT_CONTEXT.HMS_TREASURY,
      operational_owner_id: operationalOwnerId,
      financial_owner_id: financialOwnerId || operationalOwnerId,
      hostel_id: hostel.id,
      config: {
        clientId: process.env.PHONEPE_CLIENT_ID || "",
        clientSecret: process.env.PHONEPE_CLIENT_SECRET || "",
        clientVersion: process.env.PHONEPE_CLIENT_VERSION || "1",
        merchantId: process.env.PHONEPE_MERCHANT_ID || "",
        saltKey: process.env.PHONEPE_SALT_KEY || "",
        saltIndex: process.env.PHONEPE_SALT_INDEX || "",
        environment: resolvedEnv,
        callbackUrl: backendUrl("/api/webhooks/payments/phonepe"),
        treasuryMode: true,
        hostelId: hostel.id,
        operationalOwnerId,
      },
    };
  }

  if (!hostel.upi_id) {
    throw new Error("CONFIG_ERROR: Owner UPI ID is not configured. Please set your UPI ID in hostel settings.");
  }

  console.info("[merchant-context] OWNER_HOSTEL (UPI direct) context resolved", {
    flow_type:             flowType,
    hostel_id:             hostelId,
    upi_id_set:            Boolean(hostel.upi_id),
  });

  return {
    provider: "PHONEPE",
    payment_domain: PAYMENT_DOMAIN.RENT_COLLECTION,
    flow_type: flowType,
    scope_type: PAYMENT_SCOPE.HOSTEL,
    merchant_context_type: MERCHANT_CONTEXT.OWNER_HOSTEL,
    merchant_context_id: hostel.id,
    operational_owner_id: operationalOwnerId,
    financial_owner_id: financialOwnerId || operationalOwnerId,
    hostel_id: hostel.id,
    config: {
      owner_upi_id: hostel.upi_id,
      owner_name: hostel.name || (hostel as any).profiles?.name || "Hostel",
      hostel_id: hostel.id,
    },
  };
}

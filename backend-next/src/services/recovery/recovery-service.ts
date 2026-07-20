import { prisma } from "@/lib/db";
import { correctionRegistry } from "./correction-registry";
import type {
  Actor,
  CorrectionCaseRecord,
  ImpactReport,
  OperationContext,
} from "./types";

function toCaseRecord(row: any): CorrectionCaseRecord {
  return {
    id: row.id,
    hostelId: row.hostel_id,
    domain: row.domain,
    caseType: row.case_type,
    tier: row.tier,
    status: row.status,
    entityRefs: row.entity_refs,
    reason: row.reason,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    beforeSnapshot: row.before_snapshot,
    previewImpact: row.preview_impact,
    executionResult: row.execution_result,
    caseDetail: row.case_detail,
    idempotencyKey: row.idempotency_key,
    dependsOn: row.depends_on,
    undoExpiresAt: row.undo_expires_at,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function writeEvent(
  tx: any,
  caseId: string,
  eventType: string,
  actor: Actor,
  reason?: string,
  snapshot?: unknown
) {
  await tx.correction_case_events.create({
    data: {
      correction_case_id: caseId,
      event_type: eventType,
      actor_id: actor.actorId,
      actor_role: actor.actorRole,
      reason: reason ?? null,
      snapshot: (snapshot as any) ?? undefined,
    },
  });
}

class RecoveryService {
  async createCase(
    caseType: string,
    ctx: OperationContext
  ): Promise<CorrectionCaseRecord> {
    const handler = correctionRegistry.resolve(caseType);
    const draft = await handler.createCase(ctx);

    const existing = await prisma.correction_cases.findUnique({
      where: { idempotency_key: draft.idempotencyKey },
    });
    if (existing) return toCaseRecord(existing);

    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.correction_cases.create({
          data: {
            hostel_id: ctx.hostelId,
            domain: draft.domain as any,
            case_type: caseType,
            tier: draft.tier as any,
            status: "DRAFT",
            entity_refs: draft.entityRefs as any,
            reason: ctx.reason,
            actor_id: ctx.actor.actorId,
            actor_role: ctx.actor.actorRole,
            before_snapshot: draft.beforeSnapshot as any,
            case_detail: draft.caseDetail as any,
            idempotency_key: draft.idempotencyKey,
            depends_on: draft.dependsOn ?? [],
            undo_expires_at: draft.undoExpiresAt ?? null,
            correlation_id: draft.correlationId ?? null,
          },
        });

        await writeEvent(tx, row.id, "CREATED", ctx.actor, ctx.reason);
        return toCaseRecord(row);
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        // Concurrent insert race — transaction is aborted, re-fetch outside it
        const existing = await prisma.correction_cases.findUniqueOrThrow({
          where: { idempotency_key: draft.idempotencyKey },
        });
        return toCaseRecord(existing);
      }
      throw err;
    }
  }

  async getCase(caseId: string): Promise<CorrectionCaseRecord> {
    const row = await prisma.correction_cases.findUniqueOrThrow({ where: { id: caseId } });
    return toCaseRecord(row);
  }

  async listCases(
    hostelId: string,
    filters?: { status?: string; domain?: string }
  ): Promise<CorrectionCaseRecord[]> {
    const rows = await prisma.correction_cases.findMany({
      where: {
        hostel_id: hostelId,
        status: filters?.status as any,
        domain: filters?.domain as any,
      },
      orderBy: { created_at: "desc" },
    });
    return rows.map(toCaseRecord);
  }

  async preview(caseId: string): Promise<ImpactReport> {
    const kase = await this.getCase(caseId);
    const handler = correctionRegistry.resolve(kase.caseType);

    const impact = await handler.computeImpact(kase);

    return await prisma.$transaction(async (tx) => {
      await tx.correction_cases.update({
        where: { id: caseId },
        data: {
          preview_impact: impact as any,
          status: kase.status === "DRAFT" ? "PREVIEW" : kase.status,
        },
      });

      await writeEvent(tx, caseId, "PREVIEWED", { actorId: kase.actorId, actorRole: kase.actorRole });
      return impact;
    });
  }
}

export const recoveryService = new RecoveryService();

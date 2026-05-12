import { prisma } from "../db";

type MaybeHostelId = string | null;

type TransitionInput = {
  attemptId: string;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string;
  source: string;
  actorId?: string | null;
  operationalOwnerId?: string | null;
  financialOwnerId?: string | null;
  hostelId?: MaybeHostelId;
  metadata?: any;
};

export class PaymentStatusEventService {
  async updateAttemptStatus(tx: any, input: TransitionInput & { data?: any }) {
    const updated = await tx.paymentAttempt.update({
      where: { id: input.attemptId },
      data: {
        ...(input.data || {}),
        status: input.toStatus,
      },
    });
    await this.append(tx, {
      ...input,
      operationalOwnerId: input.operationalOwnerId || updated.owner_id || null,
      financialOwnerId: input.financialOwnerId === undefined ? updated.owner_id || null : input.financialOwnerId,
      hostelId: input.hostelId === undefined ? updated.hostel_id || null : input.hostelId,
    });
    return updated;
  }

  async updateAttemptStatusOutsideTransaction(input: TransitionInput & { data?: any }) {
    return prisma.$transaction((tx) => this.updateAttemptStatus(tx, input));
  }

  async append(tx: any, input: TransitionInput) {
    await tx.$queryRaw`SELECT id FROM payment_attempts WHERE id = ${input.attemptId}::uuid FOR UPDATE`;
    const rows = await tx.$queryRaw<Array<{ next_sequence: number }>>`
      SELECT COALESCE(MAX(transition_sequence), 0) + 1 AS next_sequence
      FROM payment_attempt_status_events
      WHERE payment_attempt_id = ${input.attemptId}::uuid
    `;
    const nextSequence = Number(rows?.[0]?.next_sequence || 1);
    return tx.paymentAttemptStatusEvent.create({
      data: {
        payment_attempt_id: input.attemptId,
        transition_sequence: nextSequence,
        from_status: input.fromStatus || null,
        to_status: input.toStatus,
        reason: input.reason || null,
        source: input.source,
        actor_id: input.actorId || null,
        operational_owner_id: input.operationalOwnerId || null,
        financial_owner_id: input.financialOwnerId || null,
        hostel_id: input.hostelId || null,
        metadata: input.metadata || null,
      },
    });
  }

  async appendOutsideTransaction(input: TransitionInput) {
    return prisma.$transaction((tx) => this.append(tx, input));
  }
}

export const paymentStatusEventService = new PaymentStatusEventService();

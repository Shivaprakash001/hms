/**
 * Repairs renewal successor agreements created with NULL contract terms.
 *
 * Cause: `renewal-offer-service.acceptOffer` copied the offer's `proposed_*`
 * columns straight onto the new agreement, and no code path ever populated
 * `proposed_payment_frequency` (`generateOffer` defaulted it to null,
 * `generateBulkOffers` hardcoded null). The resulting DRAFT successor was
 * missing `contract_payment_frequency`, so pressing "Sign & Finalize Renewal"
 * failed the signing path's readiness check
 * (`renewal-readiness-engine.checkLifecycleComplete`) with
 * AGREEMENT_LIFECYCLE_INCOMPLETE → HTTP 409, and cron auto-activation silently
 * logged RENEWAL_ACTIVATION_BLOCKED and skipped it. Neither the tenant nor the
 * owner had any way to clear it from the UI.
 *
 * The service now inherits these terms from the predecessor at both offer
 * generation and offer acceptance, and refuses acceptance outright when they
 * can't be resolved (see Business-Rules.md, ADR-028). This script fixes rows
 * written before that change.
 *
 * Scope: only unsigned (DRAFT) renewal successors. Signed/active agreements are
 * left alone — a NULL term there is a different problem and must not be
 * silently rewritten under a live contract.
 *
 * Idempotent: only rows still holding a NULL are touched.
 *
 *   npm run repair:renewal-successor-terms              # dry run
 *   npm run repair:renewal-successor-terms -- --apply   # write
 */
import { prisma } from "../lib/db";
import { getMissingAgreementLifecycleFields } from "../src/services/tenants/agreement-lifecycle-completeness";

type Resolution = {
  agreement_id: string;
  predecessor_id: string | null;
  missing_before: string[];
  missing_after: string[];
  updates: Record<string, unknown>;
  resolvable: boolean;
};

function inherit(successorValue: unknown, predecessor: any, column: string, snapshotKey: string) {
  if (successorValue !== null && successorValue !== undefined) return undefined;
  const snapshot = (predecessor?.content_snapshot || {}) as Record<string, any>;
  return predecessor?.[column] ?? snapshot[snapshotKey] ?? undefined;
}

export async function resolveBrokenSuccessors(): Promise<Resolution[]> {
  const drafts = await prisma.agreement.findMany({
    where: { renewed_from_agreement_id: { not: null }, status: "DRAFT" },
    include: { renewed_from_agreement: true },
  });

  return drafts
    .map((successor: any) => {
      const predecessor = successor.renewed_from_agreement;
      const missingBefore = getMissingAgreementLifecycleFields(successor);
      if (missingBefore.length === 0) return null;

      const updates: Record<string, unknown> = {};
      const paymentFrequency = inherit(successor.contract_payment_frequency, predecessor, "contract_payment_frequency", "payment_frequency");
      const maintenanceType = inherit(successor.contract_maintenance_type, predecessor, "contract_maintenance_type", "maintenance_type");
      const maintenance = inherit(successor.contract_maintenance, predecessor, "contract_maintenance", "maintenance_charge");
      if (paymentFrequency !== undefined) updates.contract_payment_frequency = paymentFrequency;
      if (maintenanceType !== undefined) updates.contract_maintenance_type = maintenanceType;
      if (maintenance !== undefined) updates.contract_maintenance = maintenance;

      const missingAfter = getMissingAgreementLifecycleFields({ ...successor, ...updates });

      return {
        agreement_id: successor.id,
        predecessor_id: successor.renewed_from_agreement_id,
        missing_before: missingBefore,
        missing_after: missingAfter,
        updates,
        resolvable: missingAfter.length === 0,
      } satisfies Resolution;
    })
    .filter((row): row is Resolution => row !== null);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const resolutions = await resolveBrokenSuccessors();

  let repaired = 0;
  if (apply) {
    for (const row of resolutions as Resolution[]) {
      if (!row.resolvable || Object.keys(row.updates).length === 0) continue;
      await prisma.agreement.update({ where: { id: row.agreement_id }, data: row.updates as any });
      repaired++;
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "APPLY" : "DRY_RUN",
    broken_found: resolutions.length,
    repairable: resolutions.filter((r) => r.resolvable).length,
    // A predecessor that is itself missing the term can't be inherited from —
    // these need the owner to reissue the renewal offer, not a data fix.
    needs_reissued_offer: resolutions.filter((r) => !r.resolvable).map((r) => ({
      agreement_id: r.agreement_id,
      still_missing: r.missing_after,
    })),
    repaired,
    details: resolutions,
  }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

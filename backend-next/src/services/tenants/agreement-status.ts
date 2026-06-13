export const SIGNED_AGREEMENT_STATUSES = [
  "SIGNED",
  "EXPIRING_SOON",
  "AGREEMENT_EXPIRED",
  "RENEWED",
  "TERMINATED",
] as const;

export const AGREEMENT_LIFECYCLE_MANAGED_STATUSES = [
  "SIGNED",
  "EXPIRING_SOON",
] as const;

export const AGREEMENT_ACTIVITY_EVENTS = {
  EXPIRING: "AGREEMENT_EXPIRING",
  EXPIRED: "AGREEMENT_EXPIRED",
  RENEWED: "AGREEMENT_RENEWED",
} as const;

export function isSignedAgreementStatus(status: string | null | undefined) {
  return SIGNED_AGREEMENT_STATUSES.includes(String(status || "").toUpperCase() as any);
}

export function signedAgreementStatusWhere() {
  return { in: [...SIGNED_AGREEMENT_STATUSES] } as any;
}

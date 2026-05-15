/**
 * Normalizes an Indian phone number to E.164 format (+91XXXXXXXXXX)
 */
export function normalizeIndianPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = String(value).replace(/\D/g, "");
  
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("91")) return `+${cleaned}`;
  if (cleaned.length === 13 && cleaned.startsWith("091")) return `+${cleaned.substring(1)}`;
  
  return null;
}

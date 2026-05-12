import { prisma } from "../../db";
import { PAYMENT_DOMAIN, PAYMENT_FLOW, PAYMENT_SCOPE, MERCHANT_CONTEXT } from "./financial-domain";

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
        merchantId: process.env.PHONEPE_MERCHANT_ID || "",
        saltKey: process.env.PHONEPE_SALT_KEY || "",
        saltIndex: process.env.PHONEPE_SALT_INDEX || "",
        environment: process.env.PHONEPE_ENV || "SANDBOX",
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/webhooks/payments/phonepe`,
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

  const hostel = await prisma.hostel.findUnique({
    where: { id: hostelId },
    include: { owner: true },
  });

  if (!hostel || hostel.owner_id !== operationalOwnerId) {
    throw new Error("HOSTEL_ACCESS_DENIED: Payment provider hostel does not belong to this owner.");
  }

  if (![PAYMENT_FLOW.RENT, PAYMENT_FLOW.ADVANCE, PAYMENT_FLOW.MANUAL_UPI_REFERENCE].includes(flowType as any)) {
    throw new Error(`UNSUPPORTED_RENT_COLLECTION_FLOW: ${flowType}`);
  }

  if (!hostel.upi_id) {
    throw new Error("CONFIG_ERROR: Owner UPI ID is not configured. Please set your UPI ID in hostel settings.");
  }

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
      owner_name: hostel.name || hostel.owner?.name || "Hostel",
      hostel_id: hostel.id,
    },
  };
}

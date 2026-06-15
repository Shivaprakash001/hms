import { resolvePhonePeEnvironment } from "./phonepe-env";

export type PaymentProviderType = "RAZORPAY" | "PHONEPE";

const VALID_PROVIDERS: PaymentProviderType[] = ["RAZORPAY", "PHONEPE"];

export function getActivePaymentProvider(): PaymentProviderType {
  const provider = process.env.PAYMENT_PROVIDER;
  if (!provider || provider.trim() === "") {
    return "PHONEPE"; // default to PhonePe for backward compatibility
  }
  const normalised = provider.trim().toUpperCase() as PaymentProviderType;
  if (!VALID_PROVIDERS.includes(normalised)) {
    throw new Error(
      `CONFIG_ERROR: PAYMENT_PROVIDER="${provider}" is not a recognised value. ` +
      `Accepted values: ${VALID_PROVIDERS.join(", ")}.`
    );
  }
  return normalised;
}

export function validatePaymentEnvironment(): void {
  const active = getActivePaymentProvider();
  if (active === "RAZORPAY") {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!keyId || keyId.trim() === "" || !keySecret || keySecret.trim() === "") {
      throw new Error(
        "PAYMENT_PROVIDER_CONFIGURATION_ERROR: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when PAYMENT_PROVIDER is RAZORPAY."
      );
    }
    if (!webhookSecret || webhookSecret.trim() === "") {
      throw new Error(
        "PAYMENT_PROVIDER_CONFIGURATION_ERROR: RAZORPAY_WEBHOOK_SECRET is required when PAYMENT_PROVIDER is RAZORPAY."
      );
    }
    console.info(`[Payment] Razorpay configured. KEY_ID suffix: ${keyId.slice(-4)}`);
  } else {
    // PhonePe validation
    const clientId = process.env.PHONEPE_CLIENT_ID;
    const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
    
    if (!clientId || clientId.trim() === "" || !clientSecret || clientSecret.trim() === "") {
      throw new Error(
        "PAYMENT_PROVIDER_CONFIGURATION_ERROR: PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET are required when PAYMENT_PROVIDER is PHONEPE."
      );
    }
    // Also validate PhonePe environment variable
    resolvePhonePeEnvironment();
  }
}

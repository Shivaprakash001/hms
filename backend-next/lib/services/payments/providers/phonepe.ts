import { PaymentProvider, CreateIntentResult, WebhookVerificationResult, FetchStatusResult } from "../provider-base";
import crypto from "crypto";

export class PhonePeProvider extends PaymentProvider {
  private get baseUrl() {
    return process.env.PHONEPE_ENV === "production"
      ? "https://api.phonepe.com/apis/hermes"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox";
  }

  private get merchantId() {
    return process.env.PHONEPE_MERCHANT_ID || this.config.merchant_id || "PGTESTPAYUAT";
  }

  private get saltKey() {
    return process.env.PHONEPE_SALT_KEY || this.config.salt_key || "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
  }

  private get saltIndex() {
    return process.env.PHONEPE_SALT_INDEX || this.config.salt_index || "1";
  }

  private generateChecksum(payloadBase64: string, endpoint: string) {
    const stringToHash = payloadBase64 + endpoint + this.saltKey;
    const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
    return `${sha256}###${this.saltIndex}`;
  }

  async createIntent(data: any): Promise<CreateIntentResult> {
    const amountInPaise = Math.round(data.amount * 100);
    const redirectUrl = process.env.PHONEPE_REDIRECT_URL || `${process.env.NEXT_PUBLIC_FRONTEND_URL}/payment-return`;
    const callbackUrl = process.env.PHONEPE_CALLBACK_URL || `${process.env.VITE_API_URL}/webhooks/payments/phonepe`;

    const payload = {
      merchantId: this.merchantId,
      merchantTransactionId: data.merchant_txn_id,
      merchantUserId: data.metadata?.student_id || "user_1",
      amount: amountInPaise,
      redirectUrl,
      redirectMode: "POST",
      callbackUrl,
      mobileNumber: data.student_phone || undefined,
      paymentInstrument: {
        type: "PAY_PAGE", // Use PAY_PAGE for web links
      },
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    const endpoint = "/pg/v1/pay";
    const checksum = this.generateChecksum(payloadBase64, endpoint);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
      },
      body: JSON.stringify({ request: payloadBase64 }),
    });

    const responseData = await response.json();

    if (!response.ok || !responseData.success) {
      console.error("PhonePe Create Intent Error:", responseData);
      throw new Error(`PhonePe Payment Creation Failed: ${responseData.message}`);
    }

    const instrumentResponse = responseData.data.instrumentResponse;
    const checkoutUrl = instrumentResponse?.redirectInfo?.url;
    // PhonePe might return intent url depending on instrument type configured
    const upiIntentUrl = instrumentResponse?.intentUrl || null;

    return {
      provider: "PHONEPE",
      merchant_txn_id: data.merchant_txn_id,
      checkout_url: checkoutUrl || null,
      upi_intent_url: upiIntentUrl,
      qr_payload: null,
      expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 min expiration
      gateway_txn_id: null,
      raw_response: responseData,
    };
  }

  async verifyWebhook(headers: any, body: any): Promise<WebhookVerificationResult> {
    const checksumHeader = headers["x-verify"] || headers["X-VERIFY"];
    if (!checksumHeader) {
      throw new Error("Missing X-VERIFY header");
    }

    // PhonePe sends { response: "base64EncodedString" }
    const rawBodyString = body.toString("utf-8");
    const parsedBody = JSON.parse(rawBodyString);
    const responseBase64 = parsedBody.response;

    // Verify signature
    const calculatedChecksum = this.generateChecksum(responseBase64, "");
    if (calculatedChecksum !== checksumHeader) {
      throw new Error("Invalid signature in PhonePe webhook");
    }

    const decodedResponse = JSON.parse(Buffer.from(responseBase64, "base64").toString("utf-8"));
    const merchantTxnId = decodedResponse.data.merchantTransactionId;
    const gatewayTxnId = decodedResponse.data.transactionId;
    const amount = decodedResponse.data.amount / 100;
    const code = decodedResponse.code;

    let status: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
    if (code === "PAYMENT_SUCCESS") status = "SUCCESS";
    else if (code === "PAYMENT_ERROR" || code === "PAYMENT_DECLINED") status = "FAILED";

    return {
      merchant_txn_id: merchantTxnId,
      gateway_txn_id: gatewayTxnId,
      status,
      amount,
      raw_event: decodedResponse,
    };
  }

  async fetchStatus(merchant_txn_id: string, gateway_txn_id?: string): Promise<FetchStatusResult> {
    const endpoint = `/pg/v1/status/${this.merchantId}/${merchant_txn_id}`;
    
    // Checksum for status API doesn't include a payload base64 part, just the endpoint
    const stringToHash = endpoint + this.saltKey;
    const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
    const checksum = `${sha256}###${this.saltIndex}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
        "X-MERCHANT-ID": this.merchantId,
      },
    });

    const responseData = await response.json();

    let status: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
    if (responseData.code === "PAYMENT_SUCCESS") status = "SUCCESS";
    else if (responseData.code === "PAYMENT_ERROR" || responseData.code === "PAYMENT_DECLINED") status = "FAILED";

    return {
      status,
      gateway_txn_id: responseData.data?.transactionId || gateway_txn_id || null,
      raw_status: responseData,
    };
  }
}

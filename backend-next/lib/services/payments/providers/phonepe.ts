import { PaymentProvider, CreateIntentResult, WebhookVerificationResult, FetchStatusResult } from "../provider-base";
import crypto from "crypto";

/**
 * PhonePe Payment Gateway — Checkout v2 (OAuth-based)
 *
 * API Flow:
 *   1. Get OAuth access_token via client_id + client_secret
 *   2. Create order via POST /checkout/v2/pay with O-Bearer token
 *   3. Webhook receives pg.order.completed / pg.order.failed
 *   4. Status polling via GET /checkout/v2/order/{merchantOrderId}/status
 *
 * Webhook security: SHA256(username:password) in Authorization header
 */
export class PhonePeProvider extends PaymentProvider {

  // ─── Environment helpers ───────────────────────────────────────
  private get isProduction() {
    return process.env.PHONEPE_ENV === "production";
  }

  private get baseUrl() {
    return this.isProduction
      ? "https://api.phonepe.com/apis/pg"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox";
  }

  private get authBaseUrl() {
    return this.isProduction
      ? "https://api.phonepe.com/apis/identity-manager"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox";
  }

  private get clientId() {
    return process.env.PHONEPE_CLIENT_ID || "";
  }

  private get clientSecret() {
    return process.env.PHONEPE_CLIENT_SECRET || "";
  }

  private get clientVersion() {
    return process.env.PHONEPE_CLIENT_VERSION || "1";
  }

  // ─── OAuth Token ───────────────────────────────────────────────
  private cachedToken: { token: string; expiresAt: number } | null = null;

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.token;
    }

    const url = `${this.authBaseUrl}/v1/oauth/token`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        client_version: this.clientVersion,
        grant_type: "client_credentials",
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error("[PhonePe] OAuth token error:", data);
      throw new Error(`PhonePe OAuth failed: ${data.message || response.statusText}`);
    }

    // Cache the token (default 20 min expiry if not provided)
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 20 * 60 * 1000),
    };

    return data.access_token;
  }

  // ─── Create Order ──────────────────────────────────────────────
  async createIntent(data: any): Promise<CreateIntentResult> {
    const accessToken = await this.getAccessToken();
    const amountInPaise = Math.round(data.amount * 100);

    const redirectUrl =
      process.env.PHONEPE_REDIRECT_URL ||
      `${process.env.NEXT_PUBLIC_FRONTEND_URL || "https://trishul.solutions"}/payment-return`;

    const payload: any = {
      merchantOrderId: data.merchant_txn_id,
      amount: amountInPaise,
      expireAfter: 1800, // 30 min
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: `Rent payment - ${data.student_name || "Tenant"}`,
        merchantUrls: {
          redirectUrl,
        },
      },
    };

    // Pass metadata as UDF fields if available
    if (data.metadata) {
      payload.metaInfo = {
        udf1: data.metadata.obligation_id || "",
        udf2: data.metadata.student_id || "",
        udf3: data.metadata.attempt_id || "",
      };
    }

    const url = `${this.baseUrl}/checkout/v2/pay`;

    console.info("[PhonePe] Creating order:", {
      merchantOrderId: data.merchant_txn_id,
      amount: data.amount,
      amountInPaise,
      url,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("[PhonePe] Create order error:", responseData);
      throw new Error(`PhonePe order creation failed: ${responseData.message || response.statusText}`);
    }

    // Response contains orderId and redirectUrl for the checkout page
    const checkoutUrl = responseData.redirectUrl || responseData.data?.redirectUrl || null;
    const orderId = responseData.orderId || responseData.data?.orderId || null;

    return {
      provider: "PHONEPE",
      merchant_txn_id: data.merchant_txn_id,
      checkout_url: checkoutUrl,
      upi_intent_url: null,
      qr_payload: null,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      gateway_txn_id: orderId,
      raw_response: responseData,
    };
  }

  // ─── Verify Webhook ────────────────────────────────────────────
  /**
   * PhonePe Checkout v2 webhook payload format:
   * {
   *   "event": "checkout.order.completed",  // or "checkout.order.failed"
   *   "payload": {
   *     "orderId": "PHONEPE_ORDER_ID",
   *     "merchantId": "...",
   *     "merchantOrderId": "YOUR_MERCHANT_TXN_ID",
   *     "state": "COMPLETED",
   *     "amount": 500000,  // in paise
   *     "paymentDetails": [{
   *       "paymentMode": "UPI_QR",
   *       "transactionId": "TXN_ID",
   *       "amount": 500000,
   *       "state": "COMPLETED"
   *     }]
   *   }
   * }
   *
   * Security: PhonePe sends Authorization header = SHA256(username:password)
   */
  async verifyWebhook(headers: any, body: any): Promise<WebhookVerificationResult> {
    // 1. Verify Basic Auth (SHA256 of username:password)
    const authHeader = headers["authorization"] || headers["Authorization"];
    const webhookUsername = process.env.PHONEPE_WEBHOOK_USERNAME || "";
    const webhookPassword = process.env.PHONEPE_WEBHOOK_PASSWORD || "";

    if (webhookUsername && webhookPassword && authHeader) {
      const expectedHash = crypto
        .createHash("sha256")
        .update(`${webhookUsername}:${webhookPassword}`)
        .digest("hex");

      if (authHeader !== expectedHash) {
        throw new Error("Invalid webhook authorization");
      }
    }

    // 2. Parse payload
    let parsed: any;
    if (typeof body === "string") {
      parsed = JSON.parse(body);
    } else if (Buffer.isBuffer(body)) {
      parsed = JSON.parse(body.toString("utf-8"));
    } else {
      parsed = body;
    }

    const event = parsed.event; // "checkout.order.completed" | "checkout.order.failed"
    const payload = parsed.payload;

    if (!payload || !payload.merchantOrderId) {
      throw new Error("Invalid webhook payload: missing merchantOrderId");
    }

    // 3. Map PhonePe state to our status
    let status: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
    const state = (payload.state || "").toUpperCase();

    if (state === "COMPLETED" || event === "checkout.order.completed" || event === "pg.order.completed") {
      status = "SUCCESS";
    } else if (state === "FAILED" || event === "checkout.order.failed" || event === "pg.order.failed") {
      status = "FAILED";
    }

    // 4. Extract payment details
    const paymentDetail = payload.paymentDetails?.[0];
    const gatewayTxnId = paymentDetail?.transactionId || payload.orderId || null;
    const amountInPaise = payload.amount || paymentDetail?.amount || 0;

    return {
      merchant_txn_id: payload.merchantOrderId,
      gateway_txn_id: gatewayTxnId,
      status,
      amount: amountInPaise / 100,
      raw_event: parsed,
    };
  }

  // ─── Fetch Status ──────────────────────────────────────────────
  async fetchStatus(merchant_txn_id: string, gateway_txn_id?: string): Promise<FetchStatusResult> {
    const accessToken = await this.getAccessToken();
    const url = `${this.baseUrl}/checkout/v2/order/${merchant_txn_id}/status`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${accessToken}`,
      },
    });

    const responseData = await response.json();

    let status: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
    const state = (responseData.state || responseData.payload?.state || "").toUpperCase();

    if (state === "COMPLETED") status = "SUCCESS";
    else if (state === "FAILED") status = "FAILED";

    return {
      status,
      gateway_txn_id: responseData.orderId || responseData.payload?.orderId || gateway_txn_id || null,
      raw_status: responseData,
    };
  }
}

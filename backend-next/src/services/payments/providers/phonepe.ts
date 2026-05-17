import { PaymentProvider, CreateIntentResult, WebhookVerificationResult, FetchStatusResult } from "../provider-base";
import crypto from "crypto";
import { resolvePhonePeEnvironment } from "../phonepe-env";

// ── Startup validation ────────────────────────────────────────────────────────
// In production deployments: resolve (and validate) PHONEPE_ENV at module load
// time so a misconfigured deployment fails immediately on cold start rather than
// silently routing traffic to sandbox endpoints.
if (process.env.NODE_ENV === "production") {
  resolvePhonePeEnvironment();
}

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
  private get environment() {
    return resolvePhonePeEnvironment();
  }

  private get isProduction() {
    return this.environment === "production";
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
    return String(this.config?.clientId || process.env.PHONEPE_CLIENT_ID || "").trim();
  }

  private get clientSecret() {
    return String(this.config?.clientSecret || process.env.PHONEPE_CLIENT_SECRET || "").trim();
  }

  private get clientVersion() {
    return String(this.config?.clientVersion || process.env.PHONEPE_CLIENT_VERSION || "1").trim();
  }

  // ─── Credential guard ────────────────────────────────────────
  private assertCredentials() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        "PhonePe credentials not configured. " +
        "Set PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET, PHONEPE_CLIENT_VERSION, and PHONEPE_ENV=production " +
        "in your Vercel environment variables."
      );
    }
    // ── DIAGNOSTIC: log resolved auth config (no secrets) ────────────────────
    console.info("[PhonePe] assertCredentials resolved", {
      environment:       this.environment,
      is_production:     this.isProduction,
      auth_mode:         this.isProduction ? "PRODUCTION OAuth" : "SANDBOX OAuth",
      oauth_url:         `${this.authBaseUrl}/v1/oauth/token`,
      checkout_url:      `${this.baseUrl}/checkout/v2/pay`,
      status_url_base:   `${this.baseUrl}/checkout/v2/order`,
      client_id_set:     Boolean(this.clientId),
      client_id_suffix:  this.clientId ? this.clientId.slice(-4) : null,
      client_version:    this.clientVersion,
    });
    if (!this.isProduction) {
      console.warn(
        `[PhonePe] ⚠️  PHONEPE_ENV is '${this.environment || "unset"}', not 'production'. ` +
        "Using sandbox endpoint — real PhonePe accounts cannot complete sandbox payments. " +
        "Set PHONEPE_ENV=production for live payments."
      );
    }
  }

  // ─── OAuth Token ───────────────────────────────────────────────
  private cachedToken: { token: string; expiresAt: number } | null = null;

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      console.info("[PhonePe] OAuth token cache hit", {
        expires_in_ms: this.cachedToken.expiresAt - Date.now(),
        environment:   this.isProduction ? "PRODUCTION" : "SANDBOX",
      });
      return this.cachedToken.token;
    }

    const url = `${this.authBaseUrl}/v1/oauth/token`;
    console.info("[PhonePe] Fetching OAuth token", {
      url,
      environment:    this.isProduction ? "PRODUCTION" : "SANDBOX",
      client_version: this.clientVersion,
      client_id_set:  Boolean(this.clientId),
      client_id_suffix: this.clientId ? this.clientId.slice(-4) : null,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        client_version: this.clientVersion,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error("[PhonePe] OAuth token error", {
        http_status:    response.status,
        environment:    this.isProduction ? "PRODUCTION" : "SANDBOX",
        oauth_url:      url,
        client_version: this.clientVersion,
        client_id_suffix: this.clientId ? this.clientId.slice(-4) : null,
        error_code:     data?.code ?? null,
        error_message:  data?.message ?? null,
        error_type:     data?.data?.type ?? null,
        full_response:  data,
      });
      throw new Error(`PhonePe OAuth failed (HTTP ${response.status}): ${data.message || response.statusText}`);
    }
    console.info("[PhonePe] OAuth token acquired", {
      environment:      this.isProduction ? "PRODUCTION" : "SANDBOX",
      expires_in:       data.expires_in ?? "(not provided — defaulting to 20 min)",
    });

    // Cache the token (default 20 min expiry if not provided)
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 20 * 60 * 1000),
    };

    return data.access_token;
  }

  // ─── Create Order ──────────────────────────────────────────────
  async createIntent(data: any): Promise<CreateIntentResult> {
    this.assertCredentials();
    const accessToken = await this.getAccessToken();
    const amountInPaise = Math.round(data.amount * 100);

    // Always embed merchant_txn_id in the return URL so the React SPA has a
    // guaranteed identifier in useSearchParams() regardless of what params
    // PhonePe appends. Without this, a POST-mode redirect loses all data
    // because the browser navigates to the URL and the POST body is discarded.
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://trishul.solutions";
    const returnBase =
      data.metadata?.flow_type === "SUBSCRIPTION" || data.metadata?.invoice_id
        ? `${frontendUrl}/dashboard/billing`
        : process.env.PHONEPE_REDIRECT_URL || `${frontendUrl}/payment-return`;
    const sep = returnBase.includes("?") ? "&" : "?";
    // For ADDON payments, embed attempt_id so the frontend can run the verify fallback
    // and show the correct success state without relying solely on sessionStorage.
    const attemptIdParam = data.metadata?.attempt_id
      ? `&attempt_id=${encodeURIComponent(data.metadata.attempt_id)}`
      : "";
    const paymentTypeParam = data.metadata?.payment_type
      ? `&payment_type=${encodeURIComponent(data.metadata.payment_type)}`
      : "";
    const flowTypeParam = data.metadata?.flow_type
      ? `&flow_type=${encodeURIComponent(data.metadata.flow_type)}`
      : "";
    const creditsParam = data.metadata?.credits
      ? `&credits=${encodeURIComponent(data.metadata.credits)}`
      : "";
    const redirectUrl = `${returnBase}${sep}merchant_txn_id=${encodeURIComponent(data.merchant_txn_id)}${attemptIdParam}${paymentTypeParam}${flowTypeParam}${creditsParam}`;

    // Clean v2 payload — no v1 fields (paymentInstrument, top-level redirectUrl/redirectMode/callbackUrl).
    // Having both paymentInstrument (v1) and paymentFlow (v2) causes the API to ignore paymentFlow
    // and return a minimal response that echoes our redirectUrl instead of a checkout page URL.
    // merchantUserId: use tenant_id (rent) or invoice_id (billing) from metadata.
    // data.tenant_id is never set — it lives in data.metadata.
    const merchantUserId =
      data.metadata?.tenant_id ||
      data.metadata?.invoice_id ||
      "unknown-user";

    const frontendOriginForLog = (process.env.NEXT_PUBLIC_FRONTEND_URL || "https://trishul.solutions");
    console.info("[PhonePe] createIntent", {
      environment:          this.isProduction ? "PRODUCTION" : "SANDBOX",
      checkout_endpoint:    `${this.baseUrl}/checkout/v2/pay`,
      merchant_order_id:    data.merchant_txn_id,
      amount:               data.amount,
      flow_type:            data.metadata?.flow_type ?? null,
      is_subscription:      Boolean(data.metadata?.flow_type === "SUBSCRIPTION" || data.metadata?.invoice_id),
      redirect_base:        process.env.PHONEPE_REDIRECT_URL ?? `${frontendOriginForLog}/payment-return`,
      NEXT_PUBLIC_FRONTEND_URL_set: Boolean(process.env.NEXT_PUBLIC_FRONTEND_URL),
      PHONEPE_REDIRECT_URL_set:     Boolean(process.env.PHONEPE_REDIRECT_URL),
    });

    const payload: any = {
      merchantOrderId: data.merchant_txn_id,
      merchantUserId,
      amount: amountInPaise,
      expireAfter: 1800,
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: data.metadata?.flow_type === "SUBSCRIPTION" || data.metadata?.invoice_id
          ? `HMS subscription - ${data.tenant_name || "Owner"}`
          : `Rent payment - ${data.tenant_name || "Tenant"}`,
        merchantUrls: {
          redirectUrl,
        },
      },
    };

    // Pass metadata as UDF fields if available
    if (data.metadata) {
      payload.metaInfo = {
        udf1: data.metadata.obligation_id || "",
        udf2: data.metadata.tenant_id || "",
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
      signal: AbortSignal.timeout(8000),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("[PhonePe] Create order error:", responseData);
      throw new Error(`PhonePe order creation failed: ${responseData.message || response.statusText}`);
    }

    console.info("[PhonePe] Create order response received:", {
      merchantOrderId: data.merchant_txn_id,
      orderId: responseData?.orderId || responseData?.data?.orderId || null,
      hasRedirectUrl: Boolean(responseData?.data?.instrumentResponse?.redirectInfo?.url || responseData?.redirectUrl),
    });

    // Extract checkout URL. PAY_PAGE returns it nested inside instrumentResponse (v1-style);
    // some v2 sandbox builds surface it at the top level as redirectUrl.
    // We check the nested path first — if PhonePe echoes OUR redirectUrl at top level
    // (as seen in logs when wrong paymentInstrument.type is used), the nested path
    // will be undefined and the guard below catches it.
    const checkoutUrl =
      responseData?.data?.instrumentResponse?.redirectInfo?.url ||
      responseData?.redirectUrl ||
      null;
    const orderId = responseData.orderId || responseData.data?.orderId || null;

    // Guard: if checkoutUrl points back to our own site it means PhonePe echoed our
    // return URL instead of giving a checkout page — this breaks the entire flow.
    const frontendOrigin = frontendUrl;
    if (!checkoutUrl || checkoutUrl.startsWith(frontendOrigin) || checkoutUrl.includes("/payment-return") || checkoutUrl.includes("/dashboard/billing")) {
      console.error("[PhonePe] Bad checkoutUrl from response:", { checkoutUrl, orderId, responseData });
      throw new Error(
        `PhonePe did not return a valid checkout URL. Got: ${checkoutUrl ?? "null"}. ` +
        `orderId=${orderId}. Check server logs for full response.`
      );
    }

    console.info("[PhonePe] Checkout URL:", { checkoutUrl, orderId });

    return {
      provider: "PHONEPE",
      merchant_txn_id: data.merchant_txn_id,
      checkout_url: checkoutUrl,
      upi_intent_url: null,
      qr_payload: null,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      gateway_txn_id: orderId,
      provider_order_id: orderId,
      provider_transaction_id: null,
      provider_reference_id: orderId,
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
    // 1. Verify Basic Auth (Authorization: Basic base64(username:password))
    const authHeader = headers["authorization"] || headers["Authorization"];
    const webhookUsername = process.env.PHONEPE_WEBHOOK_USERNAME || "";
    const webhookPassword = process.env.PHONEPE_WEBHOOK_PASSWORD || "";

    if (webhookUsername && webhookPassword && authHeader) {
      let isValid = false;

      // Handle traditional Basic Auth approach (sent by PhonePe sandbox / dashboard UI)
      if (authHeader.startsWith("Basic ")) {
        const encoded = authHeader.substring(6);
        const decoded = Buffer.from(encoded, "base64").toString("utf-8");
        const [username, password] = decoded.split(":");
        if (username === webhookUsername && password === webhookPassword) {
          isValid = true;
        }
      } 
      // Fallback for SHA256 approach if PhonePe sends raw hash matching legacy docs
      else {
        const expectedHash = crypto
          .createHash("sha256")
          .update(`${webhookUsername}:${webhookPassword}`)
          .digest("hex");
        if (authHeader === expectedHash) {
          isValid = true;
        }
      }

      if (!isValid) {
        throw new Error("Invalid webhook authorization credentials");
      }
    } else {
      throw new Error("Invalid webhook authorization credentials");
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
    const providerOrderId = payload.orderId || null;
    const providerTxnId = paymentDetail?.transactionId || null;
    const amountInPaise = payload.amount || paymentDetail?.amount || 0;

    return {
      merchant_txn_id: payload.merchantOrderId,
      gateway_txn_id: gatewayTxnId,
      provider_transaction_id: providerTxnId,
      provider_order_id: providerOrderId,
      provider_reference_id: providerTxnId || providerOrderId,
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
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`PhonePe API fetchStatus failed with HTTP ${response.status}`);
    }

    const responseData = await response.json();

    let status: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
    const state = (responseData.state || responseData.payload?.state || "").toUpperCase();

    if (state === "COMPLETED") status = "SUCCESS";
    else if (state === "FAILED") status = "FAILED";

    return {
      status,
      gateway_txn_id: responseData.orderId || responseData.payload?.orderId || gateway_txn_id || null,
      provider_order_id: responseData.orderId || responseData.payload?.orderId || gateway_txn_id || null,
      provider_transaction_id: responseData.transactionId || responseData.payload?.transactionId || null,
      provider_reference_id: responseData.transactionId || responseData.payload?.transactionId || responseData.orderId || responseData.payload?.orderId || gateway_txn_id || null,
      raw_status: responseData,
    };
  }
}

import axios from "axios";
import { PaymentProvider, CreateIntentResult, WebhookVerificationResult, FetchStatusResult } from "./provider-base";
import { generateSHA256, compareDigest } from "./crypto";

export class PhonePeProvider extends PaymentProvider {
  private get baseUrl() {
    return this.config.base_url || "https://api.phonepe.com/apis/pg";
  }

  private async getAuthHeaders() {
    // For simplicity, using bearer token from config
    return {
      Authorization: `O-Bearer ${this.config.bearer_token}`,
      "Content-Type": "application/json",
    };
  }

  async createIntent(data: any): Promise<CreateIntentResult> {
    const payload = {
      merchantOrderId: data.merchant_txn_id,
      amount: Math.round(data.amount * 100),
      expireAfter: this.config.expires_in_seconds || 900,
      metaInfo: data.metadata,
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: this.config.payment_message || "Hostel rent payment",
        merchantUrls: {
          redirectUrl: this.config.redirect_url || "",
          callbackUrl: this.config.callback_url || "",
        },
      },
      customerMobile: data.student_phone,
      customerEmail: data.student_email,
      customerName: data.student_name,
    };

    const headers = await this.getAuthHeaders();
    const response = await axios.post(`${this.baseUrl}/checkout/v2/pay`, payload, { headers });
    const res = response.data;
    const dataBlock = res.data || {};

    return {
      provider: "PHONEPE",
      merchant_txn_id: data.merchant_txn_id,
      checkout_url: dataBlock.instrumentResponse?.redirectInfo?.url || res.redirectUrl,
      upi_intent_url: dataBlock.intentUrl,
      qr_payload: dataBlock.instrumentResponse?.qrData || dataBlock.qrData,
      expires_at: dataBlock.expireAt ? new Date(dataBlock.expireAt) : null,
      gateway_txn_id: res.orderId || dataBlock.transactionId,
      raw_response: res,
    };
  }

  async verifyWebhook(headers: any, body: any): Promise<WebhookVerificationResult> {
    const provided = (headers["x-verify"] || "").trim();
    const saltKey = this.config.salt_key;
    const saltIndex = this.config.salt_index;

    if (provided && saltKey) {
      const base64Body = Buffer.from(body).toString("base64");
      const digest = generateSHA256(`${base64Body}${saltKey}`);
      const expected = `${digest}###${saltIndex}`;
      if (!compareDigest(provided, expected)) {
        throw new Error("Invalid PhonePe signature");
      }
    }

    const data = JSON.parse(body.toString());
    const pl = data.payload || data;
    const statusMap: any = {
      COMPLETED: "SUCCESS",
      SUCCESS: "SUCCESS",
      FAILED: "FAILED",
      EXPIRED: "EXPIRED",
      CANCELLED: "CANCELLED",
    };

    return {
      merchant_txn_id: pl.merchantOrderId || pl.merchantTransactionId,
      gateway_txn_id: pl.transactionId,
      status: statusMap[String(pl.state || pl.status).toUpperCase()] || "PENDING",
      amount: pl.amount / 100,
      raw_event: data,
    };
  }

  async fetchStatus(merchant_txn_id: string, gateway_txn_id?: string): Promise<FetchStatusResult> {
    const path = `/checkout/v2/order/${merchant_txn_id}/status`;
    const headers = await this.getAuthHeaders();
    const response = await axios.get(`${this.baseUrl}${path}`, { headers });
    const res = response.data;
    const pl = res.data || res;

    const statusMap: any = {
      COMPLETED: "SUCCESS",
      SUCCESS: "SUCCESS",
      FAILED: "FAILED",
      EXPIRED: "EXPIRED",
      CANCELLED: "CANCELLED",
    };

    return {
      status: statusMap[String(pl.state || pl.status).toUpperCase()] || "PENDING",
      gateway_txn_id: pl.transactionId || gateway_txn_id,
      raw_status: res,
    };
  }
}

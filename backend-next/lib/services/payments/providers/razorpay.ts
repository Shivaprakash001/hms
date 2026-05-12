import axios from "axios";
import { PaymentProvider, CreateIntentResult, WebhookVerificationResult, FetchStatusResult } from "../provider-base";
import { generateHMAC, compareDigest } from "../crypto";

export class RazorpayProvider extends PaymentProvider {
  private get auth() {
    return {
      auth: {
        username: this.config.key_id,
        password: this.config.key_secret,
      },
    };
  }

  private get baseUrl() {
    return this.config.base_url || "https://api.razorpay.com";
  }

  async createIntent(data: any): Promise<CreateIntentResult> {
    const expireBy = Math.floor(Date.now() / 1000) + (this.config.expires_in_seconds || 900);
    const payload = {
      amount: Math.round(data.amount * 100),
      currency: this.config.currency || "INR",
      accept_partial: false,
      expire_by: expireBy,
      reference_id: data.merchant_txn_id,
      description: this.config.description || "Hostel rent payment",
      upi_link: true,
      notify: { sms: false, email: false },
      notes: data.metadata,
      customer: {
        name: data.tenant_name || "Tenant",
        email: data.tenant_email || "",
        contact: data.tenant_phone || "",
      },
    };

    const response = await axios.post(`${this.baseUrl}/v1/payment_links`, payload, this.auth);
    const resData = response.data;

    const upiLink = resData.short_url || resData.upi_link;
    return {
      provider: "RAZORPAY",
      merchant_txn_id: data.merchant_txn_id,
      checkout_url: upiLink,
      upi_intent_url: upiLink,
      qr_payload: resData.upi_qr || resData.qr_code || upiLink,
      expires_at: new Date(expireBy * 1000),
      gateway_txn_id: resData.id,
      provider_order_id: resData.id,
      provider_transaction_id: null,
      provider_reference_id: resData.id,
      raw_response: resData,
    };
  }

  async verifyWebhook(headers: any, body: any): Promise<WebhookVerificationResult> {
    const signature = headers["x-razorpay-signature"];
    const secret = this.config.webhook_secret;

    if (secret && signature) {
      const expected = generateHMAC(secret, body);
      if (!compareDigest(signature, expected)) {
        throw new Error("Invalid Razorpay signature");
      }
    }

    const data = JSON.parse(body.toString());
    const pl = data.payload || {};
    const link = pl.payment_link?.entity || {};
    const payment = pl.payment?.entity || {};

    const statusMap: any = {
      paid: "SUCCESS",
      captured: "SUCCESS",
      cancelled: "CANCELLED",
      expired: "EXPIRED",
      failed: "FAILED",
    };

    return {
      merchant_txn_id: link.reference_id || payment.notes?.merchant_txn_id,
      gateway_txn_id: payment.id || link.id,
      provider_transaction_id: payment.id || null,
      provider_order_id: link.id || null,
      provider_reference_id: payment.id || link.id || null,
      status: statusMap[String(link.status || payment.status).toLowerCase()] || "PENDING",
      amount: (payment.amount || link.amount) / 100,
      raw_event: data,
    };
  }

  async fetchStatus(merchant_txn_id: string, gateway_txn_id?: string): Promise<FetchStatusResult> {
    if (!gateway_txn_id) throw new Error("Gateway ID required");
    const response = await axios.get(`${this.baseUrl}/v1/payment_links/${gateway_txn_id}`, this.auth);
    const data = response.data;

    const statusMap: any = {
      paid: "SUCCESS",
      cancelled: "CANCELLED",
      expired: "EXPIRED",
      created: "PENDING",
    };

    return {
      status: statusMap[String(data.status).toLowerCase()] || "PENDING",
      gateway_txn_id: data.id,
      provider_order_id: data.id,
      provider_transaction_id: data.payments?.[0]?.payment_id || null,
      provider_reference_id: data.payments?.[0]?.payment_id || data.id,
      raw_status: data,
    };
  }
}

export interface CreateIntentResult {
  provider: string;
  merchant_txn_id: string;
  checkout_url?: string | null;
  upi_intent_url?: string | null;
  qr_payload?: string | null;
  expires_at?: Date | null;
  gateway_txn_id?: string | null;
  raw_response: any;
}

export interface WebhookVerificationResult {
  merchant_txn_id: string;
  gateway_txn_id?: string | null;
  status: "SUCCESS" | "FAILED" | "PENDING" | "CANCELLED" | "EXPIRED";
  amount?: number | null;
  raw_event: any;
}

export interface FetchStatusResult {
  status: "SUCCESS" | "FAILED" | "PENDING" | "CANCELLED" | "EXPIRED";
  gateway_txn_id?: string | null;
  raw_status: any;
}

export abstract class PaymentProvider {
  constructor(protected config: any) {}
  
  abstract createIntent(data: {
    amount: number;
    merchant_txn_id: string;
    tenant_name: string;
    tenant_email?: string;
    tenant_phone?: string;
    metadata: any;
  }): Promise<CreateIntentResult>;

  abstract verifyWebhook(headers: Record<string, string>, body: string | Buffer): Promise<WebhookVerificationResult>;

  abstract fetchStatus(merchant_txn_id: string, gateway_txn_id?: string): Promise<FetchStatusResult>;
}

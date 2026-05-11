export type WhatsAppTemplateLanguage = {
  code: string;
};

export type WhatsAppTemplateParameter = {
  type: "text";
  text: string;
};

export type WhatsAppTemplateComponent = {
  type: "body";
  parameters: WhatsAppTemplateParameter[];
};

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string;
  language?: WhatsAppTemplateLanguage;
  bodyParameters?: string[];
};

export type WhatsAppSendResult = {
  providerMessageId: string | null;
  raw: unknown;
  attempts: number;
};

export type MetaWhatsAppErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export type WhatsAppProviderConfig = {
  accessToken: string;
  phoneNumberId: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
};

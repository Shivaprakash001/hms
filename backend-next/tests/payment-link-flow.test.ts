import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "../app/api/payments/pay/[token]/route";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  return {
    prisma: {
      payment_link_tokens: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
    paymentService: {
      createMultiObligationPaymentIntent: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/src/services/payments/payment-service", () => ({
  paymentService: mocks.paymentService,
}));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("Payment Link Token Public Flow", () => {
  const mockToken = "12345678-1234-1234-1234-1234567890ab";

  describe("GET /api/payments/pay/[token]", () => {
    it("returns 404 when token is not found", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce(null);

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toContain("Payment Not Found");
    });

    it("returns 410 when token has expired", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce({
        token: mockToken,
        expires_at: new Date(Date.now() - 1000), // Expired
        rent_obligations: { status: "PENDING", amount: 5000, rent_month: new Date() },
        tenants: { profiles: { name: "John Doe" } },
        hostels: { name: "Adithya Hostel", phone: "1234567890" },
      });

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const text = await response.text();
      expect(text).toContain("Payment link expired");
    });

    it("returns 200 with PAID status if obligation is already paid", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce({
        token: mockToken,
        expires_at: new Date(Date.now() + 100000),
        rent_obligations: { status: "PAID", amount: 5000, rent_month: new Date(), payments: [] },
        tenants: { profiles: { name: "John Doe" } },
        hostels: { name: "Adithya Hostel", phone: "1234567890" },
      });

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Payment already completed");
    });

    it("returns 200 with DUE status and payment button if obligation is pending", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce({
        token: mockToken,
        expires_at: new Date(Date.now() + 100000),
        rent_obligations: { status: "PENDING", amount: 5000, rent_month: new Date(), payments: [] },
        tenants: { profiles: { name: "John Doe" } },
        hostels: { name: "Adithya Hostel", phone: "1234567890" },
      });

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Amount Due");
      expect(text).toContain("Pay Now");
    });
  });

  describe("POST /api/payments/pay/[token]", () => {
    it("redirects 302 to checkout_url when payment attempt is successfully created/reused", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce({
        token: mockToken,
        expires_at: new Date(Date.now() + 100000),
        obligation_id: "ob-1",
        tenant_id: "tenant-1",
        hostel_id: "hostel-1",
        owner_id: "owner-1",
        rent_obligations: { status: "PENDING", amount: 5000 },
        tenants: { profiles: { name: "John Doe" } },
        hostels: { name: "Adithya Hostel", phone: "1234567890" },
      });

      mocks.paymentService.createMultiObligationPaymentIntent.mockResolvedValueOnce({
        id: "attempt-123",
        checkout_url: "https://checkout.razorpay.com/v1/checkout.html",
        status: "PENDING",
      });

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`, { method: "POST" });
      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("https://checkout.razorpay.com/v1/checkout.html");
    });

    it("returns 503 if no checkout URL is returned", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce({
        token: mockToken,
        expires_at: new Date(Date.now() + 100000),
        obligation_id: "ob-1",
        tenant_id: "tenant-1",
        hostel_id: "hostel-1",
        owner_id: "owner-1",
        rent_obligations: { status: "PENDING", amount: 5000 },
        tenants: { profiles: { name: "John Doe" } },
        hostels: { name: "Adithya Hostel", phone: "1234567890" },
      });

      mocks.paymentService.createMultiObligationPaymentIntent.mockResolvedValueOnce({
        id: "attempt-123",
        status: "CREATED", // No checkout_url
      });

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`, { method: "POST" });
      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(503);
      const text = await response.text();
      expect(text).toContain("Payment checkout is temporarily unavailable");
    });
  });
});

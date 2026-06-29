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
        hostels: {
          name: "Adithya Hostel",
          phone: "1234567890",
          address: "123 Main St",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500081",
          logo_url: "https://example.com/logo.png"
        },
      });

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const text = await response.text();
      expect(text).toContain("Payment Link Expired");
    });

    it("returns 200 with PAID status if obligation is already paid", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce({
        token: mockToken,
        expires_at: new Date(Date.now() + 100000),
        rent_obligations: { status: "PAID", amount: 5000, rent_month: new Date(), payments: [] },
        tenants: { profiles: { name: "John Doe" } },
        hostels: {
          name: "Adithya Hostel",
          phone: "1234567890",
          address: "123 Main St",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500081",
          logo_url: "https://example.com/logo.png"
        },
      });

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Payment Completed");
    });

    it("returns 200 with DUE status and payment button if obligation is pending", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce({
        token: mockToken,
        expires_at: new Date(Date.now() + 100000),
        rent_obligations: { status: "PENDING", amount: 5000, rent_month: new Date(), payments: [] },
        tenants: { profiles: { name: "John Doe" } },
        hostels: {
          name: "Adithya Hostel",
          phone: "1234567890",
          address: "123 Main St",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500081",
          logo_url: "https://example.com/logo.png"
        },
      });

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Amount Due");
      expect(text).toContain("Proceed to Secure Payment");
    });

    it("returns 200 with DUE status when token has recoverable prefix or is URL encoded", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValue({
        token: mockToken,
        expires_at: new Date(Date.now() + 100000),
        rent_obligations: { status: "PENDING", amount: 5000, rent_month: new Date(), payments: [] },
        tenants: { profiles: { name: "John Doe" } },
        hostels: {
          name: "Adithya Hostel",
          phone: "1234567890",
          address: "123 Main St",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500081",
          logo_url: "https://example.com/logo.png"
        },
      });

      const recoverableTokens = [
        `extra${mockToken}`,
        `{{1}}${mockToken}`,
        `%7B%7B1%7D%7D${mockToken}`,
        `%7B%7B%7B%7D%7Td${mockToken}`,
      ];

      for (const token of recoverableTokens) {
        const request = new NextRequest(`http://localhost/api/payments/pay/${token}`);
        const response = await GET(request, { params: Promise.resolve({ token }) });

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain("Amount Due");
      }
    });

    it("returns 404 and does not query Prisma for unrecoverable/garbage tokens", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockClear();

      const garbageTokens = [
        "garbageuuid",
        "random-text-1234",
        "uuidgarbage",
        `${mockToken}extra`,
      ];

      for (const token of garbageTokens) {
        const request = new NextRequest(`http://localhost/api/payments/pay/${token}`);
        const response = await GET(request, { params: Promise.resolve({ token }) });

        expect(response.status).toBe(404);
        const text = await response.text();
        expect(text).toContain("Payment Not Found");
      }

      expect(mocks.prisma.payment_link_tokens.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/payments/pay/[token]", () => {
    it("returns JSON with success and attempt when payment attempt is successfully created/reused", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce({
        token: mockToken,
        expires_at: new Date(Date.now() + 100000),
        obligation_id: "ob-1",
        tenant_id: "tenant-1",
        hostel_id: "hostel-1",
        owner_id: "owner-1",
        rent_obligations: { status: "PENDING", amount: 5000 },
        tenants: { profiles: { name: "John Doe" } },
        hostels: {
          name: "Adithya Hostel",
          phone: "1234567890",
          address: "123 Main St",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500081",
          logo_url: "https://example.com/logo.png"
        },
      });

      mocks.paymentService.createMultiObligationPaymentIntent.mockResolvedValueOnce({
        id: "attempt-123",
        status: "PENDING",
      });

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`, { method: "POST" });
      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.attempt.id).toBe("attempt-123");
    });

    it("verifies payment signature when action is verify", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockResolvedValueOnce({
        token: mockToken,
        expires_at: new Date(Date.now() + 100000),
        obligation_id: "ob-1",
        tenant_id: "tenant-1",
        hostel_id: "hostel-1",
        owner_id: "owner-1",
        rent_obligations: { status: "PENDING", amount: 5000 },
        tenants: { profiles: { name: "John Doe" } },
        hostels: {
          name: "Adithya Hostel",
          phone: "1234567890",
          address: "123 Main St",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500081",
          logo_url: "https://example.com/logo.png"
        },
      });

      const mockVerifyResult = {
        status: "SUCCESS",
        attempt: { id: "attempt-123", status: "SUCCESS" }
      };
      
      const verifySpy = vi.fn().mockResolvedValueOnce(mockVerifyResult);
      mocks.paymentService.verifyPaymentStatus = verifySpy;

      const request = new NextRequest(`http://localhost/api/payments/pay/${mockToken}`, {
        method: "POST",
        body: JSON.stringify({
          action: "verify",
          attempt_id: "attempt-123",
          razorpay_payment_id: "pay-1",
          razorpay_order_id: "order-1",
          razorpay_signature: "sig-1"
        })
      });
      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.status).toBe("SUCCESS");
      expect(verifySpy).toHaveBeenCalledWith({
        userId: "owner-1",
        role: "OWNER",
        attemptId: "attempt-123",
        razorpay_payment_id: "pay-1",
        razorpay_order_id: "order-1",
        razorpay_signature: "sig-1"
      });
    });

    it("returns 400 and does not query Prisma for unrecoverable/garbage tokens on POST", async () => {
      mocks.prisma.payment_link_tokens.findUnique.mockClear();

      const garbageTokens = [
        "garbageuuid",
        "random-text-1234",
        "uuidgarbage",
      ];

      for (const token of garbageTokens) {
        const request = new NextRequest(`http://localhost/api/payments/pay/${token}`, { method: "POST" });
        const response = await POST(request, { params: Promise.resolve({ token }) });

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe("Invalid payment token format.");
      }

      expect(mocks.prisma.payment_link_tokens.findUnique).not.toHaveBeenCalled();
    });
  });
});

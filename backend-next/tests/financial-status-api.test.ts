import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTestOwner, createTestHostel } from "./factories/owner-factory";
import { createTestTenant, allocateTestRoom } from "./factories/tenant-factory";
import { createTestRoom } from "./factories/room-factory";
import { createTestObligation, createTestPayment } from "./factories/payment-factory";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/payments/financial-status/route";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("Financial Status API Endpoint Tests", () => {
  let owner: any;
  let hostel: any;
  let tenant: any;
  let room: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.$executeRaw`TRUNCATE TABLE "test"."profiles" CASCADE`;

    owner = await createTestOwner();
    hostel = await createTestHostel(owner.id);
    room = await createTestRoom(hostel.id);
    tenant = await createTestTenant(owner.id, hostel.id);
    await allocateTestRoom(tenant.id, room.id, { hostel_id: hostel.id });
  });

  it("returns 401 if unauthorized", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/payments/financial-status?tenant_id=" + tenant.id);
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 if tenant_id is missing", async () => {
    vi.mocked(getSession).mockResolvedValue({
      sub: owner.id,
      role: "OWNER",
      email: owner.email,
    } as any);
    const req = new NextRequest("http://localhost/api/payments/financial-status");
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(400);
  });

  it("returns 403 if TENANT requests another tenant's status", async () => {
    vi.mocked(getSession).mockResolvedValue({
      sub: "00000000-0000-0000-0000-000000000000",
      role: "TENANT",
      email: "tenant2@example.com",
    } as any);
    const req = new NextRequest(`http://localhost/api/payments/financial-status?tenant_id=${tenant.id}`);
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(403);
  });

  it("returns 403 if OWNER requests status of a tenant they do not own", async () => {
    const anotherOwner = await createTestOwner();
    vi.mocked(getSession).mockResolvedValue({
      sub: anotherOwner.id,
      role: "OWNER",
      email: anotherOwner.email,
    } as any);
    const req = new NextRequest(`http://localhost/api/payments/financial-status?tenant_id=${tenant.id}`);
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(403);
  });

  it("returns 200 with correct financial status for authorized OWNER", async () => {
    vi.mocked(getSession).mockResolvedValue({
      sub: owner.id,
      role: "OWNER",
      email: owner.email,
    } as any);

    // Create an obligation of 15000 with 5000 paid -> 10000 outstanding (payable_now)
    const obligation = await createTestObligation(tenant.id, owner.id, hostel.id, { amount: 15000, total_amount: 15000 });
    await createTestPayment(obligation.id, 5000);

    const req = new NextRequest(`http://localhost/api/payments/financial-status?tenant_id=${tenant.id}`);
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.payable_now).toBe(10000);
    expect(json.data.fully_settled).toBe(false);
  });
});

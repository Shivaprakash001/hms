import { prisma } from "../db";

export class BillingService {
  async getOwnerUsage(ownerId: string) {
    const [roomsUsed, tenantsUsed, hostelsUsed] = await Promise.all([
      prisma.room.count({ where: { hostel: { owner_id: ownerId } } }),
      prisma.student.count({ where: { owner_id: ownerId, status: { not: "LEFT" } } }),
      prisma.hostel.count({ where: { owner_id: ownerId, is_active: true } })
    ]);

    // Plan limits - in a real app, fetch from Subscription model
    const limits = {
      rooms: 50,
      hostels: 1,
      tenants: Infinity
    };

    return {
      rooms: { used: roomsUsed, limit: limits.rooms },
      tenants: { used: tenantsUsed, limit: limits.tenants },
      hostels: { used: hostelsUsed, limit: limits.hostels }
    };
  }

  async getSubscriptionDetails(ownerId: string) {
    const usage = await this.getOwnerUsage(ownerId);
    
    // Fallback "STARTER" plan data
    return {
      current_plan: {
        name: "Starter",
        code: "STARTER",
        price: 0,
        currency: "INR"
      },
      usage,
      subscription: {
        status: "FREE",
        renewal_required: false
      },
      billing_history: []
    };
  }
}

export const billingService = new BillingService();

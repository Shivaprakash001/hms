import { prisma } from "../db";

export class ActivityService {
  async getOwnerActivity(params: {
    userId: string;
    search?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    const { userId, search, type, limit = 20, offset = 0 } = params;

    // In a real app, I'd use an ActivityLog table. 
    // For this migration, I'll aggregate from Payments and Allocations as the original does.
    const [payments, allocations] = await Promise.all([
      prisma.payment.findMany({
        where: { owner_id: userId },
        include: { student: { include: { profile: true } } },
        orderBy: { payment_date: "desc" },
        take: 100
      }),
      prisma.roomAllocation.findMany({
        where: { student: { owner_id: userId } },
        include: { student: { include: { profile: true } }, room: true },
        orderBy: { start_date: "desc" },
        take: 100
      })
    ]);

    let events: any[] = [];

    // Map payments
    payments.forEach(p => {
      events.push({
        id: `payment_${p.id}`,
        event_type: "PAYMENT_RECEIVED",
        title: "Payment Received",
        detail: `Received ₹${Number(p.amount_paid).toLocaleString()} via ${p.payment_method}`,
        tenant_name: p.student.profile.name,
        amount: Number(p.amount_paid),
        event_at: p.payment_date
      });
    });

    // Map allocations
    allocations.forEach(a => {
      events.push({
        id: `join_${a.id}`,
        event_type: "TENANT_JOINED",
        title: "Tenant Joined",
        detail: `${a.student.profile.name} moved into Room ${a.room.room_no}`,
        tenant_name: a.student.profile.name,
        room_no: a.room.room_no,
        event_at: a.start_date
      });

      if (a.end_date) {
        events.push({
          id: `left_${a.id}`,
          event_type: "TENANT_LEFT",
          title: "Tenant Left",
          detail: `${a.student.profile.name} left Room ${a.room.room_no}`,
          tenant_name: a.student.profile.name,
          room_no: a.room.room_no,
          event_at: a.end_date
        });
      }
    });

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      events = events.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.detail.toLowerCase().includes(q) || 
        e.tenant_name.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (type) {
      events = events.filter(e => e.event_type === type);
    }

    // Sort and Paginate
    events.sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime());
    
    return {
      items: events.slice(offset, offset + limit),
      total: events.length
    };
  }
}

export const activityService = new ActivityService();

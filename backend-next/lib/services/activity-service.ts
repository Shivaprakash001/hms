import { prisma } from "../db";
import { formatCurrency } from "../format";

export class ActivityService {
  async getOwnerActivity(params: {
    userId: string;
    hostelId: string;
    search?: string;
    type?: string;
    limit?: number;
    offset?: number;
    start_date?: string;
    end_date?: string;
  }) {
    const { userId, hostelId, search, type, limit = 20, offset = 0, start_date, end_date } = params;

    if (!hostelId) throw new Error("HOSTEL_CONTEXT_REQUIRED: hostelId is required for activity queries");

    const dateFilter: any = {};
    if (start_date) dateFilter.gte = new Date(start_date);
    if (end_date)   dateFilter.lte = new Date(end_date);

    const [payments, allocations] = await Promise.all([
      prisma.payments.findMany({
        where: {
          owner_id: userId,
          hostel_id: hostelId,
          ...(Object.keys(dateFilter).length > 0 ? { payment_date: dateFilter } : {}),
        },
        include: { tenant: { include: { profile: true } } },
        orderBy: { payment_date: "desc" },
        take: 200,
      }),
      prisma.roomAllocation.findMany({
        where: {
          hostel_id: hostelId,
          tenant: { owner_id: userId },
          ...(Object.keys(dateFilter).length > 0 ? { start_date: dateFilter } : {}),
        },
        include: { tenant: { include: { profile: true } }, room: true },
        orderBy: { start_date: "desc" },
        take: 200,
      }),
    ]);

    let events: any[] = [];

    // Map payments
    payments.forEach(p => {
      events.push({
        id: `payment_${p.id}`,
        event_type: "PAYMENT_RECEIVED",
        title: "Payment Received",
        detail: `Received ${formatCurrency(Number(p.amount_paid))} via ${p.payment_method}`,
        tenant_name: p.tenant.profile.name,
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
        detail: `${a.tenant.profile.name} moved into Room ${a.room.room_no}`,
        tenant_name: a.tenant.profile.name,
        room_no: a.room.room_no,
        event_at: a.start_date
      });

      if (a.end_date) {
        events.push({
          id: `left_${a.id}`,
          event_type: "TENANT_LEFT",
          title: "Tenant Left",
          detail: `${a.tenant.profile.name} left Room ${a.room.room_no}`,
          tenant_name: a.tenant.profile.name,
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

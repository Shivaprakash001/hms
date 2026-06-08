import { EventEmitter } from "events";
import { activityService } from "../services/activity.service";
import { broadcast } from "./event-bus";
import { invalidateHostelDashboardCache, invalidatePortfolioCache } from "../cache/dashboard-cache";
import { dashboardSnapshotService } from "../services/dashboard-snapshot-service";

class HMSEventEmitter extends EventEmitter {
  /**
   * Alias for emit to match the FastAPI trigger_event pattern
   */
  async trigger(eventName: string, data: any) {
    console.log(`[Event Triggered]: ${eventName}`, data);
    
    if (data.owner_id) {
      if (data.hostel_id) {
        // Hostel-level event: invalidate hostel cache AND mark portfolio stale
        // (portfolio aggregates all hostels, so any hostel mutation affects it)
        invalidateHostelDashboardCache(data.hostel_id);
        dashboardSnapshotService.markOwnerStale(data.owner_id).catch(() => {});
      } else {
        // Portfolio-level event: only invalidate portfolio cache
        invalidatePortfolioCache(data.owner_id);
      }
      
      // Auto-broadcast to SSE clients
      broadcast(data.owner_id, {
        scope: data.hostel_id ? "hostel" : "portfolio",
        hostelId: data.hostel_id,
        type: eventName,
        data
      });
    }

    this.emit(eventName, data);
  }
}

export const eventSystem = new HMSEventEmitter();

// --- Activity Log Handlers ---

eventSystem.on("tenant_created", async (data) => {
  await activityService.log({
    userId: data.creator_id || data.owner_id,
    ownerId: data.owner_id,
    actionType: "CREATE",
    entityType: "TENANT",
    entityId: data.tenant_id,
    metadata: { email: data.email, hostel_id: data.hostel_id }
  });
});

eventSystem.on("tenant_updated", async (data) => {
  await activityService.log({
    userId: data.userId || data.owner_id,
    ownerId: data.owner_id,
    actionType: "UPDATE",
    entityType: "TENANT",
    entityId: data.tenant_id,
    metadata: { name: data.name, email: data.email, hostel_id: data.hostel_id }
  });
});

eventSystem.on("tenant_allocated_room", async (data) => {
  await activityService.log({
    userId: data.owner_id,
    ownerId: data.owner_id,
    actionType: "ALLOCATE",
    entityType: "ROOM",
    entityId: data.room_id,
    metadata: { 
      tenant_id: data.tenant_id,
      allocation_id: data.allocation_id,
      hostel_id: data.hostel_id
    }
  });
});

eventSystem.on("tenant_transferred", async (data) => {
  await activityService.log({
    userId: data.owner_id,
    ownerId: data.owner_id,
    actionType: "TRANSFER",
    entityType: "TENANT",
    entityId: data.tenant_id,
    metadata: {
      from_hostel_id: data.from_hostel_id,
      to_hostel_id: data.to_hostel_id,
      hostel_id: data.to_hostel_id
    }
  });
});

eventSystem.on("tenant_status_changed", async (data) => {
  await activityService.log({
    userId: data.userId || data.owner_id,
    ownerId: data.owner_id,
    actionType: "STATUS_CHANGE",
    entityType: "TENANT",
    entityId: data.tenant_id,
    metadata: { status: data.status, hostel_id: data.hostel_id }
  });
});

eventSystem.on("tenant_reactivated", async (data) => {
  await activityService.log({
    userId: data.userId || data.owner_id,
    ownerId: data.owner_id,
    actionType: "REACTIVATE",
    entityType: "TENANT",
    entityId: data.tenant_id,
    metadata: { hostel_id: data.hostel_id }
  });
});

eventSystem.on("payment_recorded", async (data) => {
  await activityService.log({
    userId: data.tenant_id || data.owner_id,
    ownerId: data.owner_id,
    actionType: "PAYMENT",
    entityType: "PAYMENT",
    entityId: data.payment_id,
    metadata: { amount: data.amount, method: data.method, hostel_id: data.hostel_id }
  });
});

eventSystem.on("rent_waived", async (data) => {
  await activityService.log({
    userId: data.userId || data.owner_id,
    ownerId: data.owner_id,
    actionType: "WAIVE",
    entityType: "RENT",
    entityId: data.obligationId,
    metadata: { hostel_id: data.hostel_id }
  });
});

eventSystem.on("rent_generated", async (data) => {
  await activityService.log({
    userId: data.owner_id,
    ownerId: data.owner_id,
    actionType: "GENERATE",
    entityType: "RENT",
    entityId: data.hostel_id,
    metadata: {
      tenant_count: data.tenant_count || data.count || 0,
      total_amount: data.total_amount || 0,
      billing_month: data.month,
      hostel_id: data.hostel_id
    }
  });
});

eventSystem.on("expense_created", async (data) => {
  await activityService.log({
    userId: data.owner_id,
    ownerId: data.owner_id,
    actionType: "CREATE",
    entityType: "EXPENSE",
    entityId: data.expense_id,
    metadata: { title: data.title, amount: data.amount, hostel_id: data.hostel_id }
  });
});

eventSystem.on("expense_updated", async (data) => {
  await activityService.log({
    userId: data.owner_id,
    ownerId: data.owner_id,
    actionType: "UPDATE",
    entityType: "EXPENSE",
    entityId: data.expense_id,
    metadata: { title: data.title, amount: data.amount, hostel_id: data.hostel_id }
  });
});

eventSystem.on("expense_deleted", async (data) => {
  await activityService.log({
    userId: data.owner_id,
    ownerId: data.owner_id,
    actionType: "DELETE",
    entityType: "EXPENSE",
    entityId: data.expense_id,
    metadata: { title: data.title, amount: data.amount, hostel_id: data.hostel_id }
  });
});

eventSystem.on("room_created", async (data) => {
  await activityService.log({
    userId: data.user_id || data.owner_id,
    ownerId: data.owner_id,
    actionType: "CREATE",
    entityType: "ROOM",
    entityId: data.room_id,
    metadata: { room_no: data.room_no, capacity: data.capacity, hostel_id: data.hostel_id }
  });
});

eventSystem.on("room_updated", async (data) => {
  await activityService.log({
    userId: data.user_id || data.owner_id,
    ownerId: data.owner_id,
    actionType: "UPDATE",
    entityType: "ROOM",
    entityId: data.room_id,
    metadata: { room_no: data.room_no, hostel_id: data.hostel_id }
  });
});

eventSystem.on("room_deleted", async (data) => {
  await activityService.log({
    userId: data.user_id || data.owner_id,
    ownerId: data.owner_id,
    actionType: "DELETE",
    entityType: "ROOM",
    entityId: data.room_id,
    metadata: { room_no: data.room_no, hostel_id: data.hostel_id }
  });
});

eventSystem.on("hostel_policy_updated", async (data) => {
  await activityService.log({
    userId: data.userId || data.owner_id,
    ownerId: data.owner_id,
    actionType: "UPDATE",
    entityType: "HOSTEL_POLICY",
    entityId: data.hostel_id,
    metadata: { changed_domains: data.changed_domains, policy_version: data.policy_version, hostel_id: data.hostel_id }
  });
});

eventSystem.on("agreement_template_updated", async (data) => {
  await activityService.log({
    userId: data.userId || data.owner_id,
    ownerId: data.owner_id,
    actionType: data.actionType || "UPDATE",
    entityType: "AGREEMENT_TEMPLATE",
    entityId: data.hostel_id,
    metadata: {
      hostel_id: data.hostel_id,
      version: data.version,
      title: data.title,
      owner_signature_url: data.owner_signature_url
    }
  });
});



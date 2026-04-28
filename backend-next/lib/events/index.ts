import { EventEmitter } from "events";
import { activityService } from "../services/activity.service";
import { broadcast } from "./event-bus";
import { invalidateDashboardCache } from "../cache/dashboard-cache";

class HMSEventEmitter extends EventEmitter {
  /**
   * Alias for emit to match the FastAPI trigger_event pattern
   */
  async trigger(eventName: string, data: any) {
    console.log(`[Event Triggered]: ${eventName}`, data);
    
    // Auto-invalidate cache if owner_id is present
    if (data.owner_id) {
      invalidateDashboardCache(data.owner_id);
      
      // Auto-broadcast to SSE clients
      broadcast(data.owner_id, {
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
    userId: data.creator_id,
    ownerId: data.owner_id,
    actionType: "CREATE",
    entityType: "TENANT",
    entityId: data.tenant_id,
    metadata: { email: data.email }
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
      allocation_id: data.allocation_id 
    }
  });
});

eventSystem.on("payment_recorded", async (data) => {
  await activityService.log({
    userId: data.tenant_id || data.owner_id,
    ownerId: data.owner_id,
    actionType: "PAYMENT",
    entityType: "PAYMENT",
    entityId: data.payment_id,
    metadata: { amount: data.amount, method: data.method }
  });
});

eventSystem.on("expense_created", async (data) => {
  await activityService.log({
    userId: data.owner_id,
    ownerId: data.owner_id,
    actionType: "CREATE",
    entityType: "EXPENSE",
    entityId: data.expense_id,
    metadata: { title: data.title, amount: data.amount }
  });
});

eventSystem.on("document_uploaded", async (data) => {
  await activityService.log({
    userId: data.tenant_id,
    ownerId: data.owner_id,
    actionType: "UPLOAD",
    entityType: "DOCUMENT",
    entityId: data.doc_id,
    metadata: { type: data.doc_type }
  });
});
eventSystem.on("document_verified", async (data) => {
  await activityService.log({
    userId: data.owner_id,
    ownerId: data.owner_id,
    actionType: data.is_verified ? "VERIFY" : "UNVERIFY",
    entityType: "DOCUMENT",
    entityId: data.doc_id,
    metadata: { tenant_id: data.tenant_id }
  });
});

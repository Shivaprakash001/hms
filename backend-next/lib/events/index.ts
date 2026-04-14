import { EventEmitter } from "events";
import { activityService } from "../services/activity.service";

class HMSEventEmitter extends EventEmitter {
  /**
   * Alias for emit to match the FastAPI trigger_event pattern
   */
  async trigger(eventName: string, data: any) {
    console.log(`[Event Triggered]: ${eventName}`, data);
    this.emit(eventName, data);
  }
}

export const eventSystem = new HMSEventEmitter();

// --- Activity Log Handlers ---

eventSystem.on("student_created", async (data) => {
  await activityService.log({
    userId: data.creator_id,
    ownerId: data.owner_id,
    actionType: "CREATE",
    entityType: "STUDENT",
    entityId: data.student_id,
    metadata: { email: data.email }
  });
});

eventSystem.on("student_allocated_room", async (data) => {
  await activityService.log({
    userId: data.owner_id,
    ownerId: data.owner_id,
    actionType: "ALLOCATE",
    entityType: "ROOM",
    entityId: data.room_id,
    metadata: { 
      student_id: data.student_id,
      allocation_id: data.allocation_id 
    }
  });
});

eventSystem.on("payment_recorded", async (data) => {
  await activityService.log({
    userId: data.student_id,
    ownerId: data.owner_id,
    actionType: "PAYMENT",
    entityType: "PAYMENT",
    entityId: data.payment_id,
    metadata: { amount: data.amount, method: data.method }
  });
});

eventSystem.on("document_uploaded", async (data) => {
  await activityService.log({
    userId: data.student_id,
    ownerId: data.owner_id,
    actionType: "UPLOAD",
    entityType: "DOCUMENT",
    entityId: data.doc_id,
    metadata: { type: data.doc_type }
  });
});

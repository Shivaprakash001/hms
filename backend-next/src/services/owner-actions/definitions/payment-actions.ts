import { ownerActionRegistry } from "../owner-action-registry";

ownerActionRegistry.register({
  actionId: "PAYMENT_RECEIVE",
  entity: "payment",
  category: "WORKFLOW",
  label: "Receive Payment",
  allowedRoles: ["OWNER"],
  isAvailable: () => true,
});

# Move Outs

## What this does

The move-out module manages tenant exit from request to inspection, settlement, payment, dispute, feedback, and completion.

## Screen breakdown

| Screen | Purpose | Data shown |
|---|---|---|
| Owner move-outs | Reviews hostel exits | Requests, statuses, tenant, settlement |
| Inspection form | Records room condition | Damage, deductions, notes |
| Settlement view | Shows payable or refundable amount | Dues, deposit, deductions |
| Tenant move-out page | Lets tenant request and track exit | Timeline, actions, dispute, feedback |

## Data it needs

- `moveOutService.listRequests(hostelId)` from `/move-out/requests`.
- `moveOutService.getRequest(id)` from `/move-out/requests/:id`.
- `moveOutService.getTimeline()` from `/move-out/timeline`.
- `moveOutService.submitRequest(payload)` from `/move-out/requests`.
- Owner actions for inspect, settle, complete, and dispute.

## Data it produces

- `move_out_requests` records.
- `move_out_inspections` and inspection items.
- Exit settlement transactions.
- Disputes and feedback.
- Tenant status and allocation release effects.

## Key components

- `MoveOutsView` renders owner move-out operations.
- `TenantMoveOutPage` renders tenant exit workflow.
- `MoveOutStepper` renders tenant-visible status steps.
- `ExitWorkflowSection` shows active move-out state in tenant profile.

## Business logic in this module

- Valid statuses are controlled by the move-out state machine.
- Direct writes to completed status are banned by service design.
- Active move-outs can block transfers, rent generation, rent edits, and profile edits.
- Tenant-facing steps hide internal state complexity.

## How this works (step by step)

1. A tenant submits a move-out request.
2. The owner reviews the request in `/hostels/:hostelId/move-outs`.
3. The owner records inspection and settlement details.
4. The state machine validates each transition.
5. Completion releases or closes operational records.

## How to reuse this for a new client

- Keep the state machine and capability guards.
- Customize inspection fields and deduction categories.
- Confirm refund and deposit settlement rules.
- Confirm whether tenant disputes are allowed.

**How this works:**
1. Status controls available actions.
2. Capability checks prevent unsafe changes during exit.
3. The tenant sees a simplified progress tracker.


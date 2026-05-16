# UI Component Refactoring Notes

This document tracks the incremental decomposition and refactoring of oversized UI components ("God components") into scalable, feature-based modules.

## ManageRooms.jsx (Phase 3A)

### Overview
`ManageRooms.jsx` was an oversized monolith component responsible for fetching room data, rendering stats, displaying floors, and managing multiple modals and sidebars. It has been partially decomposed.

### Extracted Components (Batch 1 - Pure Presentational)
The following pure presentational components were extracted from `ManageRooms.jsx` into `@features/rooms/components/`:
- `StatCard.jsx` - Generic statistics tile used in the header.
- `RoomCard.jsx` - Displays individual room status, occupancy, and delete actions.
- `RoomDetailSidebar.jsx` - The sliding right sidebar showing room capacity, occupants, and management actions (Shift, Call, Remove).
- `TenantProfileModal.jsx` - A complex modal showing the tenant's full profile, contact info, financials, and recent payments. Contains internal reusable components (`SummaryTile`, `InfoTile`).
- Re-located Modal Components - Moved existing modals (`AddRoomModal`, `AddFloorModal`, `AddTenantModal`, `ShiftTenantModal`, `EditRoomModal`) from legacy `components/owner/rooms` into the `@features/rooms/components` boundary.

### Extracted Helpers (Batch 2 - Pure Functions)
The following data transformation logic was extracted into `@features/rooms/utils/roomHelpers.js`:
- `normalizeFloors` - Pure function to structure floor/room responses and apply statuses.
- `findRoomById` - Array lookup utility.
- `calculateRoomStats` - Encapsulates all the complex `.reduce()` math to derive `totalRooms`, `totalCapacity`, `totalOccupants`, and `occupancyRate` safely.

### Remaining Responsibilities in Parent (`ManageRooms.jsx`)
- State management (`selectedRoom`, `showAddRoomModal`, `filterStatus`, etc.).
- Custom hooks usage (`useRooms`, `useAppPreferences`).
- Data fetching logic and error handling (`fetchData`, `handleDeleteRoom`, `handleAddTenant`, `handleShiftTenant`, etc.).
- Main layout orchestration.

### Repeated Patterns Discovered
- **Derived Stats Math**: `floors.reduce(...)` is calculated manually on render. This should be moved to a custom hook like `useRoomStats(floors)`.
- **Status Styles**: `getStatusStyle()` is repeated or similar across different components. Needs a shared constant/utility `roomConstants.js`.
- **Date/Currency formatting**: Consistent use of `formatDate` and `formatCurrency` is good, but `TenantProfileModal` repeats identical layout structures for `InfoTile` and `SummaryTile`.

### Future Optimization Opportunities
- Extract all API handlers (`handleCallTenant`, `handleAddRoom`, `handleAddTenant`, `handleShiftTenant`) into a `useRoomActions` custom hook to massively shrink the parent component.
- The `TenantProfileModal` is technically a "Tenant" feature, and could eventually be moved to `@features/tenants/components` once the tenant UI decomposition begins.

### Risky Coupling Areas
- `handleAddTenant` contains mixed responsibilities: it handles both tenant creation/reactivation AND room allocation within the same try-catch block. This is a complex transactional flow that should live in a backend service or a robust frontend hook, not directly inside the UI component.

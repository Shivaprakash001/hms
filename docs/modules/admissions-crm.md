# Admissions CRM

## What this does
Admissions CRM turns QR visitors into trackable leads, then into tenant invitations. Owners can see student interest, parent decision context, activity, notes, reservations, and conversion readiness without retyping lead data.

## Screen breakdown
- QR visit page: lets visitors explore a hostel, submit quick details, view rooms, and express interest.
- Hostel explorer: shows availability, pricing, safety, food, rules, and other hostels by the same owner.
- Admissions CRM: shows owner lead columns by status.
- Lead detail: shows parent details, activity timeline, notes, status actions, reservation action, and invitation conversion.

## Data it needs
- Public hostel data from `GET /api/visit/:hostelSlug`.
- Lead capture from `POST /api/visit/:hostelSlug/leads`.
- Owner lead lists from `GET /api/admissions/leads`.
- Lead detail and notes from `/api/leads/:id`.
- Room options from existing `/api/rooms`.

## Data it produces
- `VisitorLead` records.
- `LeadActivity` records.
- `LeadNote` records.
- `RoomReservation` records for intent-only holds.
- Tenant invitations through the existing invitation service.

## Key components
- `VisitPage`: renders the public QR admission journey.
- `AdmissionsView`: renders the owner CRM board and detail workspace.
- `LeadCard`: renders a compact lead card for Kanban columns.
- `LeadDetail`: renders parent, activity, note, reservation, and conversion actions.

## Business logic in this module
- Student name and phone are required for lead capture.
- Email is optional during capture and required before invitation conversion.
- Parent name, parent phone, decision maker, and parent follow-up flags are first-class CRM data.
- Room reservations never allocate a bed.
- Lead conversion calls the existing tenant invitation flow.
- Lost reasons use structured categories for analytics.

## How this works (step by step)
1. Visitor scans `/visit/:hostelSlug`.
2. The public route fetches safe hostel and room data.
3. Visitor submits student details without account creation.
4. Backend creates or updates an active lead for the same hostel and phone.
5. Visitor room actions create lead activity and update lead score.
6. Owner opens `/admissions` and reviews leads by status.
7. Owner adds follow-up notes or marks parent follow-up.
8. Owner adds email and selected room before conversion.
9. Backend calls the existing invitation service.
10. Tenant activation later marks the connected lead as joined.

## How to reuse this for a new client
- Keep the lead, activity, note, and reservation models.
- Replace public trust content, photos, rules, and food messaging.
- Configure hostel `public_slug` values before QR printing.
- Keep conversion tied to the existing invitation flow.
- Revisit lost reasons only if the client has different admission objections.

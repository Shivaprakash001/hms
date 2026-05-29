# Admissions CRM

## What this does
Admissions CRM turns QR visitors into trackable leads, then into tenant invitations. Owners can see student interest, parent decision context, activity, notes, reservations, and conversion readiness without retyping lead data.

## Screen breakdown
- QR visit page: lets visitors explore a hostel, submit quick details, view rooms, and express interest.
- Hostel explorer: shows availability, pricing, safety, food, facilities, rooms, and other hostels by the same owner.
- Room detail: shows room photos, rent, included facilities, and privacy-safe roommate preview.
- Interest confirmation: confirms room interest and offers parent sharing.
- Owner hostel selector: lets visitors switch between all active hostels from the same owner.
- Owner admissions dashboard: shows KPIs, funnel bars, recent activity, quick actions, and compact QR cards.
- Lead pipeline: shows desktop Kanban columns and mobile status tabs.
- QR generator: shows configurable QR preview, copy action, and print action.
- Lead profile: shows parent details, activity timeline, notes, status actions, reservation action, and invitation conversion.

## Data it needs
- Public hostel data from `GET /api/visit/:hostelSlug`.
- Owner hostel options from the same public visit response.
- Lead capture from `POST /api/visit/:hostelSlug/leads`.
- Owner lead lists from `GET /api/admissions/leads`.
- Lead detail and notes from `/api/leads/:id`.
- Owner hostel slugs from `GET /api/owner/hostels`.
- Room options from existing `/api/rooms`.

## Data it produces
- `VisitorLead` records.
- `LeadActivity` records.
- `LeadNote` records.
- `RoomReservation` records for intent-only holds.
- Tenant invitations through the existing invitation service.

## Key components
- `VisitPage`: renders the public QR admission journey, room detail, confirmation, and parent sharing screens.
- `AdmissionsView`: renders the owner dashboard, pipeline, QR generator, and lead profile screens.
- `AdmissionQrPanel`: renders QR codes and visit links for hostel reception use.
- `LeadCard`: renders a compact lead card for Kanban columns.
- `LeadProfile`: renders parent, activity, note, reservation, and conversion actions.

## Business logic in this module
- Student name and phone are required for lead capture.
- Email is optional during capture and required before invitation conversion.
- Parent name, parent phone, decision maker, and parent follow-up flags are first-class CRM data.
- Room reservations never allocate a bed.
- Admissions reservation expiry runs once daily on Vercel Hobby.
- Lead conversion calls the existing tenant invitation flow.
- Lost reasons use structured categories for analytics.

## How this works (step by step)
1. Visitor scans `/visit/:hostelSlug`.
2. The public route fetches safe hostel, room, and owner-hostel options.
3. Visitor can switch to another hostel from the same owner.
4. Visitor submits student details without account creation.
5. Backend creates or updates an active lead for the selected hostel and phone.
6. Visitor room actions create lead activity and update lead score.
7. Owner opens `/admissions` and copies or prints the hostel QR.
8. Owner reviews leads by status.
9. Owner adds follow-up notes or marks parent follow-up.
10. Owner adds email and selected room before conversion.
11. Backend calls the existing invitation service.
12. Tenant activation later marks the connected lead as joined.

## How to reuse this for a new client
- Keep the lead, activity, note, and reservation models.
- Replace public trust content, photos, rules, and food messaging.
- Configure hostel `public_slug` values before QR printing.
- Keep conversion tied to the existing invitation flow.
- Revisit lost reasons only if the client has different admission objections.

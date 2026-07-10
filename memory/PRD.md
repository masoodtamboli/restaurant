# Latur Tahari House v2 — Multi-tenant Dine-In Ordering + Platform

## Purpose
Table-side QR ordering app for **Latur Tahari House**, Kondhwa, Pune. Multi-tenant-ready platform: super admin creates restaurants and admin accounts, each restaurant owner (single admin role, no other staff roles) runs their live queue, menu, tables, promos, subscription. Customers scan QR → WhatsApp OTP (mocked) → order → track → request bill → get itemized bill via WhatsApp (mocked) after admin taps CLEAN TABLE.

## What v2 adds on top of v1
1. **Multi-tenant scoping** — every collection carries `restaurant_id`; all queries filter by it.
2. **WhatsApp Business (MOCKED)** — OTP delivery, itemized bill delivery, promo broadcasts all log `[MOCK-WHATSAPP …]`. Single-file swap to Meta Cloud API when creds arrive.
3. **PIN-based admin login** — phone + 4–6 digit PIN (bcrypt), no email/password. Locked-out admins get PIN reset by super admin.
4. **Super admin platform layer** — separate login at `/super-admin/login`, unlinked from customer/admin flows. Restaurant CRUD, admin creation, PIN reset, subscription approval, plan management.
5. **Subscription-gated admin dashboard** — active subscription required for the entire `/api/admin/*` surface (except `/admin/login`, `/admin/me`, `/admin/subscriptions/*`). Expired returns 402 → frontend redirects to `/admin/renew`. Customer ordering stays live throughout.
6. **Subscription flow** — 3 seeded plans (1mo ₹799 / 3mo ₹2400 / 6mo ₹6000), UPI QR auto-generated per price (via api.qrserver.com), admin scans + uploads screenshot (base64) + UTR reference, super admin approves via single callable `activate_subscription()` (ready for future payment webhook to call the same function).
7. **Staff-call button** — persistent on menu + tracking, opens 3 fixed reasons (water/cutlery/complaint) + optional note. Admin queue surfaces call count banner; separate `/admin/staff-calls` screen with per-call RESOLVE.
8. **Clean-table action** — replaces v1's "Close" button. Builds itemized bill from all rounds in the session, MOCK-sends WhatsApp template, closes session, admin sees preview modal.
9. **Promo composer** — 3 seeded WhatsApp templates (Happy Hour, Weekend Special, Iftar), fill variables, broadcast to opted-in customers, sent history log.
10. **Multi-tenant menu, tables, orders, sessions, users** — v1 already had these; now all scoped to a specific restaurant.

## Data model additions vs v1
- `restaurants`, `super_admins`, `staff_calls`, `promo_templates`, `promo_sends`, `subscription_plans`, `subscriptions`, `bill_sends`, `super_admin_sessions`, `user_sessions` (renamed from `sessions`).
- `admins`: switched from email/pass to phone/PIN + `created_by`.
- `users`: added `whatsapp_opted_in`.
- All modified: added `restaurant_id`.

## Tech
- Backend: FastAPI + Motor MongoDB, bcrypt (PIN hashing), UUID session tokens.
- Frontend: Expo Router SDK 54 with file-based routes, `expo-image`, `expo-image-picker` (payment proof upload), AsyncStorage.
- Central theme at `/app/frontend/src/theme.ts` (single source of truth for colors, radius, spacing, font, shadows) — every screen imports from it.

## Route map
- Customer: `/`, `/otp`, `/menu`, `/item/[id]`, `/cart`, `/tracking`, `/call-staff`
- Admin: `/admin/login`, `/admin/queue`, `/admin/staff-calls`, `/admin/menu`, `/admin/tables`, `/admin/promos`, `/admin/sales`, `/admin/customers`, `/admin/subscription`, `/admin/renew`
- Super admin: `/super-admin/login`, `/super-admin/restaurants`, `/super-admin/subscriptions`, `/super-admin/plans`

## Out of scope (per user spec)
Online payment for customer bills, delivery/pickup, native push, Firebase, staff roles beyond admin, table reservations, in-app chat, bill splitting, multi-language, ML/AI features, automated payment gateway (schema ready, logic manual for now).

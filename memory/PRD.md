# Latur Tahari House — QR Dine-In Ordering (PRD)

## Purpose
Table-side ordering app for **Latur Tahari House**, Kondhwa, Pune. Customer scans QR on their table, phone-verifies with OTP, orders directly from the phone in multiple "rounds" tied to a single table session. Kitchen sees orders live. Staff use a separate admin dashboard for queue, menu, tables & sales.

## MVP scope
- QR-based table binding + phone OTP login (mock OTP `123456` in v1, MSG91 later).
- Menu browse (7 categories: Tahari, Biryani, Tandoori, Curries, Rotis, Sides, Beverages) with veg/non-veg indicators and "popular" tags.
- Item detail with spice-level selector and quantity stepper.
- Cart with upsell ("pairs well with") when order has only mains.
- Multi-round session: new orders attach to the same table session until "Request Bill".
- Live tracking screen with per-round status (received → preparing → ready → served), polling every 5s.
- Persistent live-status bar on menu when rounds are pending.
- Admin dashboard: live order queue (bill-requested tables surfaced first), menu CRUD + availability/popular toggles, tables with QR generation (via api.qrserver.com), sales stats (revenue, best sellers, avg turn), customer list w/ loyalty points.
- Loyalty accrual: 1 point per ₹10 on completed orders.
- Pay-at-counter only (no payment integration in v1).

## Data model
`users` (id, phone, name, loyalty_points) · `tables` (id, table_number, qr_code_url, is_active) · `table_sessions` (id, table_id, status: open/bill_requested/closed, total_bill, user_ids[]) · `products` (id, name, category, price, is_veg, is_popular, is_available, image_url, spice_level_options[]) · `orders` (id, table_session_id, round_no, items[], subtotal, status) · `admins` · `sessions` / `admin_sessions` (auth tokens).

## Tech
- Backend: FastAPI + Motor (MongoDB), bcrypt for admin, UUID session tokens for customer/admin.
- Frontend: Expo Router (SDK 54) with file-based routes. React Native components. `expo-image` for network images. AsyncStorage-based lightweight session/cart persistence.
- Design: Custom "Deccani heritage" palette — maroon #7A1F2B, saffron #D4A017, cream #FDF6EC, charcoal #2B1810, slab-serif display + sans body, 12px card radius, 4px button radius.

## Out of scope
Online payment, delivery/pickup, loyalty redemption, multi-location, reservations, chat, ratings, ML recs, bill splitting, i18n.

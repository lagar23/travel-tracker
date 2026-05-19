# Travel Planner — Real App Design Spec

**Date:** 2026-05-19
**Status:** Approved
**Scope:** Turn `~/travel-tracker/index.html` into a cloud-backed web app with Google auth, Supabase database, and a modular vanilla JS file structure. No framework, no bundler.

---

## Overview

The current travel planner is a single-file HTML app (CSS + JS inline, localStorage persistence). This spec covers turning it into a real app where:

- Data lives in Supabase (not localStorage)
- Each user logs in with Google and sees only their own trips
- The app works on any device (phone, tablet, laptop)
- The UI and design are unchanged — this is a backend migration + file structure refactor, not a redesign
- The door is left open for phase 2: Gmail scanning to auto-populate trips from booking confirmation emails

---

## Goals

1. Data persists in the cloud, accessible from any device
2. Each user (currently Laura + her friend) has their own account and their own trips
3. Built properly enough that it could eventually be opened to more users
4. Forward-compatible with Gmail email scanning (phase 2)

---

## Out of Scope

- UI changes (covered by separate revamp spec)
- Gmail scanning / email parsing (phase 2, separate spec)
- Mobile-responsive layout (still desktop-first for now)
- Custom domain (decided later)
- React or any frontend framework

---

## Architecture

**Client:** Vanilla JS modules, no bundler, GitHub Pages hosting
**Backend:** Supabase (database + auth)
**Auth:** Google OAuth via Supabase
**Security:** Row Level Security (RLS) — database enforces per-user data isolation

No server. The browser calls Supabase directly using the public anon key. RLS policies ensure each user can only read and write their own rows, even if someone had the API key.

---

## File Structure

```
travel-tracker/
├── index.html          ← app shell: auth gate + calendar mount point
├── config.js           ← Supabase URL + anon key (public, safe to commit)
├── src/
│   ├── main.js         ← entry: boot, auth check, initial render
│   ├── auth.js         ← Google OAuth via Supabase, session management
│   ├── db.js           ← all Supabase calls — trips/events CRUD, never touched directly by other modules
│   ├── calendar.js     ← calendar render logic (ported from current app)
│   ├── editor.js       ← add/edit trip & event forms
│   ├── status.js       ← status bar: today's location, unbooked count, next trip
│   └── style.css       ← all styles (ported from current app)
└── docs/
    └── superpowers/specs/
```

Each file has one responsibility. Nothing outside `db.js` calls Supabase. Nothing outside `auth.js` touches sessions.

---

## Data Model

### `trips` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | primary key, auto-generated |
| `user_id` | uuid | foreign key → auth.users |
| `label` | text | "Mallorca", "Ireland" |
| `country` | text | ISO code: "ES", "IE" |
| `flag` | text | emoji flag: "🇪🇸" |
| `css_class` | text | colour token from existing system |
| `start_date` | date | |
| `end_date` | date | |
| `booked` | — | not stored; derived in JS from flight_in/flight_out/accom (see Booking State below) |
| `note` | text | nullable |
| `source` | text | `'manual'` or `'email'` |
| `booking_ref` | text | nullable — confirmation number |
| `provider` | text | nullable — "Ryanair", "Booking.com" |
| `flight_in` | jsonb | flight that brought you to this stay (see Flight schema) |
| `flight_out` | jsonb | flight that takes you away from this stay |
| `accom` | jsonb | accommodation details (see Accom schema) |

**Flight schema (flight_in / flight_out):**
```json
{
  "date": "2026-05-06",
  "from": "LHR",
  "to": "PMI",
  "number": "FR1234",
  "booking_ref": "ABC123",
  "confirmed": null,
  "source": "manual"
}
```
`confirmed`: `null` = derive from booking_ref; `true`/`false` = manual override.
`source`: where this data came from — `'email'` or `'manual'`. Editable regardless.

**Accom schema:**
```json
{
  "name": "Hotel Es Saluet",
  "address": "...",
  "booked": null,
  "booking_ref": "XYZ789",
  "source": "manual"
}
```

### `events` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | primary key |
| `user_id` | uuid | foreign key → auth.users |
| `label` | text | "Sonorama", "Reception" |
| `start_date` | date | |
| `end_date` | date | |
| `color` | text | colour token from existing system |
| `note` | text | nullable |
| `trip_id` | uuid | nullable — optionally links to a trip |
| `source` | text | `'manual'` or `'email'` |
| `booking_ref` | text | nullable |

### Booking State Logic

`booked` on a trip is **derived**, not a manual checkbox:

```
flight_in.confirmed  ?? (flight_in.booking_ref  != null)
flight_out.confirmed ?? (flight_out.booking_ref != null)
accom.booked         ?? (accom.booking_ref      != null)

trip.booked = all three are truthy (where applicable)
```

The UI shows the derived state. A small "override" option lets the user force `confirmed: true/false` if the ref isn't in the system yet.

### RLS Policies

Both tables get the same policy set:
- `SELECT` where `user_id = auth.uid()`
- `INSERT` where `user_id = auth.uid()`
- `UPDATE` where `user_id = auth.uid()`
- `DELETE` where `user_id = auth.uid()`

---

## Auth Flow

1. User lands on app → no session → centered screen with app name + "Sign in with Google"
2. Click → Google OAuth popup (Supabase handles this)
3. User approves → redirected back → session established
4. Supabase SDK stores session in localStorage automatically; persists across refreshes and devices
5. `auth.js` exposes `getSession()` and `onAuthChange(callback)` — the rest of the app never touches Supabase auth directly

---

## Migration — Existing Data

Current data lives in localStorage under key `travel-2026`. Steps:

1. Open current app → Export JSON (button already exists) — saves trips + events to a file
2. Run one-time `migrate.js` script: reads JSON, maps fields to new schema, inserts into Supabase under authenticated user's `user_id`
3. Verify data in Supabase dashboard
4. Remove DEFAULT_STAYS / DEFAULT_EVENTS fallback from app once migration confirmed

---

## Deployment

- Hosting: GitHub Pages (existing)
- CI: one GitHub Action on push to `main` → deploy `travel-tracker/` to Pages
- No build step (no bundler)
- `config.js` contains Supabase anon key — safe to commit (protected by RLS, not a secret key)
- Supabase project: free tier, sufficient for personal use indefinitely

---

## Phase 2 Preview — Gmail Scanning

When ready:

1. Request additional Google OAuth scope: `https://www.googleapis.com/auth/gmail.readonly`
2. Supabase Edge Function (server-side) calls Gmail API, searches for booking confirmation emails
3. Parser extracts: airline, hotel, dates, confirmation numbers → writes to `trips`/`events` with `source: 'email'`
4. User reviews and confirms; can edit any field (the schema supports this already)

The Google login chosen now is load-bearing for this — same token, new scope, no new login flow.

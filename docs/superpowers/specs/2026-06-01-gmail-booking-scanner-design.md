# Gmail Booking Scanner — Design Spec
**Date:** 2026-06-01  
**Status:** Approved for implementation

---

## Overview

Automatically scan the user's Gmail for booking confirmation emails on login, parse them into structured booking data, match them against existing stays, and present suggestions for the user to accept, edit, or dismiss via a review drawer.

---

## Approach

Client-side only. The Gmail API is called directly from the browser using the Google OAuth access token already present in the Supabase session. No backend, no new infrastructure.

---

## Schema Changes

Two new columns on the `trips` table:

```sql
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_transportation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_stay BOOLEAN NOT NULL DEFAULT false;
```

- `booked` column remains in the DB for backwards compatibility but is no longer written on save. In the app it is always derived: `booked = booked_transportation AND booked_stay`
- `flight_in` / `flight_out` kept as-is (transport leg generalisation deferred)
- Each stay on the calendar is its own record — no parent/child grouping

---

## Booking Status Model

Each trip has two independent user-controlled flags:

| Flag | Meaning | Set by |
|------|---------|--------|
| `booked_transportation` | User considers all transport sorted | User checkbox |
| `booked_stay` | User considers accommodation sorted | User checkbox |

**Red dot on calendar:** shown if either flag is false (future trips only).  
**Gmail never auto-ticks either flag.** It only populates content fields (`flight_in`, `flight_out`, `accom`). The user decides when they're "booked."

---

## Auth & Gmail Scope

`auth.js` — add `gmail.readonly` to the OAuth scope request:

```js
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'email profile gmail.readonly',
    redirectTo: window.location.origin + window.location.pathname,
  }
})
```

On login, `main.js` checks if the session token includes Gmail scope by attempting a lightweight Gmail API call. If the call returns 403 (scope missing) → show notification bar State 4 (Connect Gmail). Existing users who logged in without Gmail scope will see State 4 and re-auth on click.

---

## New File: `src/gmail.js`

Single exported function:

```js
export async function scanGmail(accessToken, stays)
  → { matched: [{booking, stay}], unmatched: [booking], lastMessageId }
```

### Fetch

Gmail API search query:
```
from:(ryanair.com OR iberia.com OR easyjet.com OR vueling.com OR aerlingus.com OR
      aireuropa.com OR lufthansa.com OR ba.com OR klm.com OR airfrance.com OR
      norwegian.com OR wizzair.com OR transavia.com OR united.com OR delta.com OR
      aa.com OR emirates.com OR flydubai.com OR qatarairways.com OR turkishairlines.com OR
      booking.com OR airbnb.com OR agoda.com OR hotels.com OR hostelworld.com OR
      renfe.es OR alsa.es OR ouibus.com OR flixbus.com OR eurostar.com OR
      blablacar.com)
OR subject:(confirmation OR reservation OR booking OR itinerary OR
           "your trip" OR "flight details" OR "check-in" OR "check in" OR
           "viaje confirmado" OR "reserva confirmada" OR "billete" OR
           "your reservation" OR "booking reference" OR "order confirmation")
after:2024/01/01
```

- Max 50 results per scan
- `localStorage` stores `gmailLastMessageId` — subsequent scans use `after:` with that ID to only fetch new emails
- Fetches `format=full` for each matching message (parallel, max 10 at a time)

### Parse

Per-sender parsers extract:
```js
{
  type: 'flight' | 'accommodation' | 'train' | 'bus',
  inbound: { date, origin, destination, ref, carrier } | null,
  outbound: { date, origin, destination, ref, carrier } | null,
  dateStart: 'YYYYMMDD',
  dateEnd: 'YYYYMMDD' | null,
  country: string | null,   // derived from destination
  ref: string,
  subject: string,
  sender: string,
  gmailUrl: string,  // https://mail.google.com/mail/u/0/#inbox/{messageId}
}
```

Emails that pass the fetch filter but fail all parsers are silently dropped.

### Match

For each parsed booking:
1. Find stays where `booking.dateStart` falls within `stay.start`–`stay.end`
2. If tie: prefer stay whose country matches `booking.country`
3. If match found → push to `matched[]`
4. If no match → push to `unmatched[]`

---

## New File: `src/gmail-drawer.js`

Renders the review drawer (mirrors `editor.js` pattern). Exports:

```js
export function openGmailDrawer(suggestions, stays, onAccept, onDismiss)
export function closeGmailDrawer()
```

### Drawer layout (flat list, Option A)

Each row shows:
- Icon + type (✈️ flight, 🏠 accommodation, 🚂 train, 🚌 bus)
- Summary line (e.g. "Ryanair FR4401 — DUB→MAD, 15 Oct 2026")
- Match line (green: "→ 🇪🇸 Spain Oct 1–31" or red: "No match found")
- Actions:
  - **Matched:** Accept / Edit / Dismiss
  - **Unmatched:** Create Stay / Dismiss
- "View email" link on every row → opens `gmailUrl` in a new tab

### "Create Stay" flow

1. User clicks "Create Stay" on an unmatched booking
2. The new-stay popup opens pre-filled with data from the booking (country, dates, label)
3. On save → `onAccept` is called → drawer re-renders with updated `stays`, potentially matching other unmatched items

### "Accept" behaviour

- Flight booking → merges into matched stay's `flight_in` or `flight_out`
- Accommodation → merges into matched stay's `accom`
- Calls `saveTrip()` with merged data
- Row disappears from drawer; drawer re-renders

### "Edit" behaviour

Opens the existing stay popup pre-filled with the suggestion data merged in, allowing the user to adjust before saving.

---

## Changes to Existing Files

### `src/status.js`
Add notification bar rendering above the existing status bar. Four states:

| State | Trigger | Appearance |
|-------|---------|------------|
| `disconnected` | No Gmail scope | Beige — "📬 Connect Gmail…" + Connect button |
| `scanning` | Scan in progress | Amber dot — "Scanning Gmail…" |
| `found` | Suggestions available | Green dot — "N booking suggestions found — click to review" + "🔄 Rescan" button |
| `uptodate` | Scan complete, nothing new | Subtle — "✓ Gmail up to date · Last scanned X ago" + "🔄 Rescan" button |

Clicking the `found` bar opens the Gmail drawer.

### `src/main.js`
- After `loadAndRender()`, call `scanGmail()` in background
- Hold `suggestions` as module-level state (same as `stays`/`events`)
- Wire notification bar click → `openGmailDrawer()`
- Wire `onAccept` → `saveTrip()` → `loadAndRender()` → re-scan

### `src/auth.js`
- Add `gmail.readonly` to OAuth scopes
- Export `getGmailAccessToken()` — extracts the **Google provider token** (not the Supabase JWT) from `session.provider_token`. This is the token passed to the Gmail API.

### `src/editor.js`
- Replace single "Booked" checkbox with two:
  - "✈️ Transportation booked" (`pBookedTransport`)
  - "🏠 Stay booked" (`pBookedStay`)

### `src/db.js`
- Read/write `booked_transportation` and `booked_stay`
- Derive `booked = booked_transportation && booked_stay` for calendar rendering

### `index.html`
- Add Gmail drawer DOM (mirrors edit drawer structure)
- Update stay popup: replace `pBooked` with `pBookedTransport` + `pBookedStay`

---

## DB Migrations

```sql
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_transportation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_stay BOOLEAN NOT NULL DEFAULT false;
```

Run via `SUPABASE_PERSONAL_ACCESS_TOKEN` + Management API (as established).

---

## Out of Scope (v1)

- Multiple transport legs per stay (deferred — will need a child table)
- Feedback tracking (how often users change suggestions)
- Per-user scan history or suggestion persistence in Supabase
- Gmail scope for other users (currently single-user app)
- Auto-accepting high-confidence matches

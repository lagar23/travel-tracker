# Gmail Booking Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically scan Gmail for booking confirmation emails on login, parse them into structured data, match them to existing stays, and present suggestions in a review drawer.

**Architecture:** Pure client-side — Gmail API called from the browser using the Google `provider_token` from the Supabase session. Two new DB columns (`booked_transportation`, `booked_stay`) replace the single `booked` flag in the editor. A new notification bar sits above the calendar; clicking it opens a Gmail review drawer.

**Tech Stack:** Vanilla ES modules, Supabase (PostgreSQL + Google OAuth), Gmail REST API v1, localStorage for scan state.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/auth.js` | Add `gmail.readonly` scope; export `getGmailAccessToken()` |
| Modify | `src/db.js` | Read/write `booked_transportation` + `booked_stay`; derive `booked` |
| Modify | `src/editor.js` | Replace single "Booked" checkbox with two; add `pBookedTransport` + `pBookedStay`; export `openGmailPreFill()` |
| Modify | `src/status.js` | Add notification bar above status line (4 states) |
| Modify | `src/main.js` | Wire Gmail scan on login; hold `suggestions` state; wire bar → drawer |
| Modify | `index.html` | Add Gmail drawer DOM; replace `pBooked` with dual checkboxes |
| Create | `src/gmail.js` | `scanGmail()` — fetch, parse, match bookings |
| Create | `src/gmail-drawer.js` | `openGmailDrawer()` / `closeGmailDrawer()` — review UI |

---

## Task 1: Run DB migrations

**Files:**
- No code files changed — Supabase schema only

- [ ] **Step 1: Run the migration via the Supabase Management API**

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/umsqfaxnyjeiujkpxuri/database/query" \
  -H "Authorization: Bearer ${SUPABASE_PERSONAL_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_transportation BOOLEAN NOT NULL DEFAULT false; ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_stay BOOLEAN NOT NULL DEFAULT false;"}' | jq .
```

Expected output: `[]`

- [ ] **Step 2: Verify the columns exist**

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/umsqfaxnyjeiujkpxuri/database/query" \
  -H "Authorization: Bearer ${SUPABASE_PERSONAL_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name FROM information_schema.columns WHERE table_name = '\''trips'\'' AND column_name IN ('\''booked_transportation'\'', '\''booked_stay'\'');"}' | jq .
```

Expected: array with two rows.

- [ ] **Step 3: Update supabase/migrations.sql to document the migration**

Append to `/Users/la.fernandez/travel-tracker/supabase/migrations.sql`:

```sql
-- 2026-06-01: Gmail booking scanner schema
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_transportation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS booked_stay BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations.sql
git commit -m "feat: add booked_transportation and booked_stay columns to trips"
```

---

## Task 2: Update auth.js — Gmail scope + token accessor

**Files:**
- Modify: `src/auth.js`

- [ ] **Step 1: Add `gmail.readonly` scope to `signInWithGoogle`**

In `src/auth.js`, replace:

```js
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}
```

With:

```js
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'email profile gmail.readonly',
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Add `getGmailAccessToken()` export**

Append to `src/auth.js` after `onAuthChange`:

```js
export async function getGmailAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session) return null;
  return data.session.provider_token ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/auth.js
git commit -m "feat: add gmail.readonly OAuth scope and getGmailAccessToken helper"
```

---

## Task 3: Update db.js — dual booking flags

**Files:**
- Modify: `src/db.js`

- [ ] **Step 1: Update `tripToApp` to read the two new columns**

In `src/db.js`, replace the `tripToApp` function:

```js
function tripToApp(row) {
  const bookedTransport = row.booked_transportation ?? false;
  const bookedStay      = row.booked_stay ?? false;
  return {
    id:       row.id,
    type:     'stay',
    label:    row.label,
    country:  row.country,
    flag:     row.flag,
    cssClass: row.css_class,
    color:    row.color || null,
    start:    fromIso(row.start_date),
    end:      fromIso(row.end_date),
    note:     row.note,
    source:   row.source,
    booking_ref: row.booking_ref,
    provider: row.provider,
    flight_in:  row.flight_in,
    flight_out: row.flight_out,
    accom:    row.accom,
    booked_transportation: bookedTransport,
    booked_stay:           bookedStay,
    booked: bookedTransport && bookedStay,
  };
}
```

- [ ] **Step 2: Update `saveTrip` to write the two new fields**

In `src/db.js`, inside `saveTrip`, replace the `row` object construction to add the new fields and remove the old `booked` write:

```js
  const row = {
    user_id:    session.user.id,
    label:      trip.label,
    country:    trip.country,
    flag:       trip.flag,
    css_class:  trip.cssClass,
    color:      trip.color || null,
    booked:     (trip.booked_transportation ?? false) && (trip.booked_stay ?? false),
    booked_transportation: trip.booked_transportation ?? false,
    booked_stay:           trip.booked_stay ?? false,
    start_date: toIso(trip.start),
    end_date:   toIso(trip.end),
    note:       trip.note || '',
    source:     trip.source || 'manual',
    booking_ref: trip.booking_ref || null,
    provider:   trip.provider || null,
    flight_in:  trip.flight_in  || null,
    flight_out: trip.flight_out || null,
    accom:      trip.accom || null,
  };
```

- [ ] **Step 3: Commit**

```bash
git add src/db.js
git commit -m "feat: read/write booked_transportation and booked_stay fields"
```

---

## Task 4: Update index.html — dual checkboxes + Gmail drawer DOM

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace single "Booked" checkbox with two checkboxes**

In `index.html`, replace:

```html
        <div class="field" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="pBooked" style="width:auto;">
          <label for="pBooked" style="font-size:11px;text-transform:none;letter-spacing:0;color:#3d2b1f;">Booked</label>
        </div>
```

With:

```html
        <div class="field" style="display:flex;flex-direction:column;gap:5px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="pBookedTransport" style="width:auto;">
            <label for="pBookedTransport" style="font-size:11px;text-transform:none;letter-spacing:0;color:#3d2b1f;">✈️ Transportation booked</label>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="pBookedStay" style="width:auto;">
            <label for="pBookedStay" style="font-size:11px;text-transform:none;letter-spacing:0;color:#3d2b1f;">🏠 Stay booked</label>
          </div>
        </div>
```

- [ ] **Step 2: Add the Gmail notification bar above the status bar**

In `index.html`, before `<div class="status-bar" id="statusLine"></div>`, add:

```html
  <div id="gmailBar" style="display:none;"></div>
```

- [ ] **Step 3: Add the Gmail drawer DOM before the closing `</div>` of `#app`**

In `index.html`, before `</div>` that closes `<div id="app">` (i.e. before `<script type="module"`), add:

```html
  <!-- GMAIL DRAWER -->
  <div class="edit-overlay" id="gmailOverlay" style="display:none;"></div>
  <div class="edit-drawer" id="gmailDrawer" style="display:none;" onclick="event.stopPropagation()">
    <div class="drawer-header">
      <h2>📬 Gmail Booking Suggestions</h2>
      <button class="popup-close" id="btnGmailDrawerClose">✕</button>
    </div>
    <p class="drawer-subtitle" id="gmailDrawerSubtitle"></p>
    <div id="gmailSuggestionList"></div>
  </div>
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add dual booking checkboxes and Gmail drawer DOM"
```

---

## Task 5: Update editor.js — wire dual checkboxes

**Files:**
- Modify: `src/editor.js`

- [ ] **Step 1: Update `clearStayFields` to reset the two new checkboxes**

In `src/editor.js`, in `clearStayFields`, replace:

```js
  document.getElementById('pBooked').checked = false;
```

With:

```js
  document.getElementById('pBookedTransport').checked = false;
  document.getElementById('pBookedStay').checked = false;
```

- [ ] **Step 2: Update `openPopupEditStay` to populate the two checkboxes**

In `src/editor.js`, in `openPopupEditStay`, replace:

```js
  document.getElementById('pBooked').checked     = s.booked;
```

With:

```js
  document.getElementById('pBookedTransport').checked = s.booked_transportation ?? false;
  document.getElementById('pBookedStay').checked      = s.booked_stay ?? false;
```

- [ ] **Step 3: Update `saveEntry` to read the two new checkboxes**

In `src/editor.js`, in `saveEntry`, replace:

```js
    const booked   = document.getElementById('pBooked').checked;
```

With:

```js
    const bookedTransport = document.getElementById('pBookedTransport').checked;
    const bookedStay      = document.getElementById('pBookedStay').checked;
```

Then in the `trip` object inside `saveEntry`, replace:

```js
      type: 'stay', country, flag, label, cssClass, color: selectedStayColor, start, end, booked, note,
```

With:

```js
      type: 'stay', country, flag, label, cssClass, color: selectedStayColor, start, end,
      booked_transportation: bookedTransport,
      booked_stay: bookedStay,
      booked: bookedTransport && bookedStay,
      note,
```

- [ ] **Step 4: Add `openGmailPreFill` export for the "Edit" flow from the drawer**

Append to `src/editor.js`:

```js
export function openGmailPreFill(suggestion, stay) {
  openPopupEditStay(null, {
    ...stay,
    flight_in:  suggestion.type === 'flight' && suggestion.inbound  ? { number: `${suggestion.inbound.carrier} ${suggestion.inbound.ref}`,  booking_ref: suggestion.ref, confirmed: null, source: 'gmail' } : stay.flight_in,
    flight_out: suggestion.type === 'flight' && suggestion.outbound ? { number: `${suggestion.outbound.carrier} ${suggestion.outbound.ref}`, booking_ref: suggestion.ref, confirmed: null, source: 'gmail' } : stay.flight_out,
    accom: suggestion.type === 'accommodation' ? { name: suggestion.inbound?.destination || '', address: '', booking_ref: suggestion.ref, booked: null, source: 'gmail' } : stay.accom,
  }, stay.start);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/editor.js
git commit -m "feat: replace single booked checkbox with dual transport/stay checkboxes"
```

---

## Task 6: Create src/gmail.js — fetch, parse, match

**Files:**
- Create: `src/gmail.js`

- [ ] **Step 1: Create the file with the fetch helper**

Create `/Users/la.fernandez/travel-tracker/src/gmail.js`:

```js
const GMAIL_SEARCH = [
  'from:(ryanair.com OR iberia.com OR easyjet.com OR vueling.com OR aerlingus.com OR',
  'aireuropa.com OR lufthansa.com OR ba.com OR klm.com OR airfrance.com OR',
  'norwegian.com OR wizzair.com OR transavia.com OR united.com OR delta.com OR',
  'aa.com OR emirates.com OR flydubai.com OR qatarairways.com OR turkishairlines.com OR',
  'booking.com OR airbnb.com OR agoda.com OR hotels.com OR hostelworld.com OR',
  'renfe.es OR alsa.es OR ouibus.com OR flixbus.com OR eurostar.com OR blablacar.com)',
  'OR subject:(confirmation OR reservation OR booking OR itinerary OR',
  '"your trip" OR "flight details" OR "check-in" OR "check in" OR',
  '"viaje confirmado" OR "reserva confirmada" OR "billete" OR',
  '"your reservation" OR "booking reference" OR "order confirmation")',
  'after:2024/01/01',
].join(' ');

const LAST_ID_KEY = 'gmailLastMessageId';

async function fetchMessageIds(token, afterId) {
  const q = afterId ? `${GMAIL_SEARCH} after:${afterId}` : GMAIL_SEARCH;
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw Object.assign(new Error('Gmail fetch failed'), { status: res.status });
  const data = await res.json();
  return data.messages?.map(m => m.id) ?? [];
}

async function fetchMessage(token, id) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchMessages(token, ids) {
  const results = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const fetched = await Promise.all(batch.map(id => fetchMessage(token, id)));
    results.push(...fetched.filter(Boolean));
  }
  return results;
}
```

- [ ] **Step 2: Add the email body decoder and sender/subject extractors**

Append to `src/gmail.js`:

```js
function getHeader(msg, name) {
  return msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function decodeBody(msg) {
  function decode(part) {
    if (part.body?.data) {
      return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.parts) return part.parts.map(decode).join('');
    return '';
  }
  return decode(msg.payload);
}

function gmailUrl(id) {
  return `https://mail.google.com/mail/u/0/#inbox/${id}`;
}
```

- [ ] **Step 3: Add per-sender parsers**

Append to `src/gmail.js`:

```js
// Parser registry: { test(sender, subject): bool, parse(body, subject, sender, msgId): booking|null }
const PARSERS = [
  {
    name: 'ryanair',
    test: (s) => s.includes('ryanair.com'),
    parse(body, subject, sender, msgId) {
      // Ryanair: "Booking confirmation XXXXXX" subject, flight numbers like FR1234
      const refM  = subject.match(/\b([A-Z0-9]{6})\b/) || body.match(/booking\s+(?:reference|ref)[:\s]+([A-Z0-9]{6})/i);
      const flightM = body.match(/\b(FR\d{3,4})\b/i);
      const routeM  = body.match(/\b([A-Z]{3})\s*[→\-–to]+\s*([A-Z]{3})\b/i);
      const dateM   = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'Ryanair' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'iberia',
    test: (s) => s.includes('iberia.com'),
    parse(body, subject, sender, msgId) {
      const refM   = body.match(/localizador[:\s]+([A-Z0-9]{6})/i) || subject.match(/\b([A-Z0-9]{6})\b/);
      const flightM = body.match(/\b(IB\d{3,4})\b/i);
      const routeM  = body.match(/\b([A-Z]{3})\s*[→\-–]+\s*([A-Z]{3})\b/i);
      const dateM   = body.match(/\b(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'Iberia' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'vueling',
    test: (s) => s.includes('vueling.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/\b([A-Z0-9]{6})\b/) || subject.match(/\b([A-Z0-9]{6})\b/);
      const routeM = body.match(/\b([A-Z]{3})\s*[→\-–]+\s*([A-Z]{3})\b/i);
      const dateM  = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'Vueling' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'aerlingus',
    test: (s) => s.includes('aerlingus.com'),
    parse(body, subject, sender, msgId) {
      const refM   = body.match(/booking\s+reference[:\s]+([A-Z0-9]{6})/i) || subject.match(/\b([A-Z0-9]{6})\b/);
      const routeM  = body.match(/\b([A-Z]{3})\s*[→\-–to]+\s*([A-Z]{3})\b/i);
      const dateM   = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'Aer Lingus' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'easyjet',
    test: (s) => s.includes('easyjet.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/booking\s+reference[:\s]+([A-Z0-9]{6,8})/i) || subject.match(/\b([A-Z0-9]{6,8})\b/);
      const routeM = body.match(/\b([A-Z]{3})\s*[→\-–to]+\s*([A-Z]{3})\b/i);
      const dateM  = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'easyJet' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'renfe',
    test: (s) => s.includes('renfe.es'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/localizador[:\s]+([A-Z0-9]{6,10})/i) || subject.match(/\b([A-Z0-9]{6,10})\b/);
      const routeM = body.match(/\b([A-ZÀ-ɏ ]+)\s*[→\-–]+\s*([A-ZÀ-ɏ ]+)\b/i);
      const dateM  = body.match(/\b(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (!refM) return null;
      const dateStart = dateM ? `${dateM[3]}${dateM[2].padStart(2,'0')}${dateM[1].padStart(2,'0')}` : null;
      return {
        type: 'train',
        inbound:  { date: dateStart, origin: routeM?.[1]?.trim() || '', destination: routeM?.[2]?.trim() || '', ref: refM[1], carrier: 'Renfe' },
        outbound: null,
        dateStart,
        dateEnd: null,
        country: 'Spain',
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'alsa',
    test: (s) => s.includes('alsa.es'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/localizador[:\s]+([A-Z0-9]{6,10})/i) || subject.match(/\b([A-Z0-9]{6,10})\b/);
      const dateM  = body.match(/\b(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (!refM) return null;
      const dateStart = dateM ? `${dateM[3]}${dateM[2].padStart(2,'0')}${dateM[1].padStart(2,'0')}` : null;
      return {
        type: 'bus',
        inbound:  { date: dateStart, origin: '', destination: '', ref: refM[1], carrier: 'ALSA' },
        outbound: null,
        dateStart,
        dateEnd: null,
        country: 'Spain',
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'airbnb',
    test: (s) => s.includes('airbnb.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/confirmation\s+code[:\s]+([A-Z0-9]{8,12})/i) || subject.match(/([A-Z0-9]{8,12})/);
      const checkInM  = body.match(/check.in[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const checkOutM = body.match(/check.out[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const dateStart = checkInM  ? parseFreeDate(checkInM[1])  : null;
      const dateEnd   = checkOutM ? parseFreeDate(checkOutM[1]) : null;
      if (!refM && !dateStart) return null;
      return {
        type: 'accommodation',
        inbound:  { date: dateStart, origin: null, destination: null, ref: refM?.[1] || '', carrier: 'Airbnb' },
        outbound: null,
        dateStart,
        dateEnd,
        country: null,
        ref: refM?.[1] || '',
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'booking',
    test: (s) => s.includes('booking.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/confirmation\s+number[:\s]+(\d{10,12})/i) || subject.match(/(\d{10,12})/);
      const checkInM  = body.match(/check.in[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const checkOutM = body.match(/check.out[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const dateStart = checkInM  ? parseFreeDate(checkInM[1])  : null;
      const dateEnd   = checkOutM ? parseFreeDate(checkOutM[1]) : null;
      if (!refM && !dateStart) return null;
      return {
        type: 'accommodation',
        inbound:  { date: dateStart, origin: null, destination: null, ref: refM?.[1] || '', carrier: 'Booking.com' },
        outbound: null,
        dateStart,
        dateEnd,
        country: null,
        ref: refM?.[1] || '',
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'agoda',
    test: (s) => s.includes('agoda.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/booking\s+(?:id|ref|number)[:\s]+([A-Z0-9\-]{5,15})/i) || subject.match(/([A-Z0-9]{8,15})/);
      const checkInM  = body.match(/check.in[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const checkOutM = body.match(/check.out[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const dateStart = checkInM  ? parseFreeDate(checkInM[1])  : null;
      const dateEnd   = checkOutM ? parseFreeDate(checkOutM[1]) : null;
      if (!refM && !dateStart) return null;
      return {
        type: 'accommodation',
        inbound:  { date: dateStart, origin: null, destination: null, ref: refM?.[1] || '', carrier: 'Agoda' },
        outbound: null,
        dateStart,
        dateEnd,
        country: null,
        ref: refM?.[1] || '',
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'generic-flight',
    test: (_s, subject) => /confirmation|booking|itinerary|billete/i.test(subject),
    parse(body, subject, sender, msgId) {
      const routeM = body.match(/\b([A-Z]{3})\s*[→\-–]+\s*([A-Z]{3})\b/);
      const refM   = body.match(/(?:booking\s+ref(?:erence)?|confirmation\s+(?:number|code)|localizador)[:\s]+([A-Z0-9]{5,12})/i);
      const dateM  = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!routeM && !refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM?.[1] || '', carrier: '' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM?.[1] || '',
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
];
```

- [ ] **Step 4: Add date normalisation and airport-to-country helpers**

Append to `src/gmail.js`:

```js
const MONTHS_SHORT = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  ene:'01',abr:'04',ago:'08' };

function normaliseDate(day, monthStr, year) {
  const m = MONTHS_SHORT[monthStr.toLowerCase().slice(0,3)];
  if (!m) return null;
  return `${year}${m}${String(day).padStart(2,'0')}`;
}

function parseFreeDate(str) {
  // "October 15, 2026" or "15 October 2026"
  const m1 = str.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  const m2 = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (m1) return normaliseDate(m1[2], m1[1], m1[3]);
  if (m2) return normaliseDate(m2[1], m2[2], m2[3]);
  return null;
}

// Minimal IATA → country mapping for common airports
const AIRPORT_COUNTRY = {
  MAD:'Spain', BCN:'Spain', AGP:'Spain', ALC:'Spain', PMI:'Spain', SVQ:'Spain', VLC:'Spain',
  DUB:'Ireland', ORK:'Ireland', SNN:'Ireland',
  LHR:'UK', LGW:'UK', LTN:'UK', STN:'UK', MAN:'UK', EDI:'UK',
  CDG:'France', ORY:'France', NCE:'France',
  FCO:'Italy', MXP:'Italy', VCE:'Italy', NAP:'Italy',
  AMS:'Netherlands', BRU:'Belgium', ZRH:'Switzerland',
  FRA:'Germany', MUC:'Germany', BER:'Germany',
  LIS:'Portugal', OPO:'Portugal', FAO:'Portugal',
  BKK:'Thailand', DMK:'Thailand',
  JFK:'USA', LAX:'USA', ORD:'USA', BOS:'USA', MIA:'USA', SFO:'USA',
  YYZ:'Canada', YUL:'Canada', YVR:'Canada',
  DXB:'UAE', AUH:'UAE',
  DOH:'Qatar', IST:'Turkey',
};
function airportCountry(iata) {
  return AIRPORT_COUNTRY[iata?.toUpperCase()] ?? null;
}
```

- [ ] **Step 5: Add the parse and match logic, then the main `scanGmail` export**

Append to `src/gmail.js`:

```js
function parseMessage(msg) {
  const sender  = getHeader(msg, 'from').toLowerCase();
  const subject = getHeader(msg, 'subject');
  const body    = decodeBody(msg);

  for (const parser of PARSERS) {
    if (parser.test(sender, subject)) {
      try {
        const booking = parser.parse(body, subject, sender, msg.id);
        if (booking) return booking;
      } catch {
        // silently drop parse errors
      }
    }
  }
  return null;
}

function matchBooking(booking, stays) {
  if (!booking.dateStart) return null;
  const ds = booking.dateStart;
  const candidates = stays.filter(s => ds >= s.start && ds <= s.end);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // Tie-break by country match
  const countryMatch = candidates.find(s => s.country === booking.country);
  return countryMatch ?? candidates[0];
}

export async function scanGmail(accessToken, stays) {
  const lastId = localStorage.getItem(LAST_ID_KEY) ?? null;
  let ids;
  try {
    ids = await fetchMessageIds(accessToken, lastId);
  } catch (err) {
    if (err.status === 403) throw Object.assign(err, { code: 'NO_GMAIL_SCOPE' });
    throw err;
  }

  if (ids.length === 0) return { matched: [], unmatched: [], lastMessageId: lastId };

  const messages = await fetchMessages(accessToken, ids);
  const bookings = messages.map(parseMessage).filter(Boolean);

  const matched   = [];
  const unmatched = [];

  for (const booking of bookings) {
    const stay = matchBooking(booking, stays);
    if (stay) {
      matched.push({ booking, stay });
    } else {
      unmatched.push(booking);
    }
  }

  const newLastId = ids[0]; // Gmail returns newest first
  localStorage.setItem(LAST_ID_KEY, newLastId);

  return { matched, unmatched, lastMessageId: newLastId };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/gmail.js
git commit -m "feat: add gmail.js with fetch/parse/match for booking confirmation emails"
```

---

## Task 7: Create src/gmail-drawer.js — review UI

**Files:**
- Create: `src/gmail-drawer.js`

- [ ] **Step 1: Create the file**

Create `/Users/la.fernandez/travel-tracker/src/gmail-drawer.js`:

```js
let _onAccept = null;
let _onDismiss = null;
let _currentSuggestions = null;
let _currentStays = null;

const TYPE_ICON = { flight: '✈️', accommodation: '🏠', train: '🚂', bus: '🚌' };

function summaryLine(booking) {
  const icon = TYPE_ICON[booking.type] ?? '📋';
  const carrier = booking.inbound?.carrier || booking.type;
  const route   = booking.inbound?.origin && booking.inbound?.destination
    ? ` — ${booking.inbound.origin}→${booking.inbound.destination}`
    : '';
  const date    = booking.dateStart
    ? ` · ${booking.dateStart.slice(0,4)}-${booking.dateStart.slice(4,6)}-${booking.dateStart.slice(6,8)}`
    : '';
  const ref     = booking.ref ? ` · Ref: ${booking.ref}` : '';
  return `${icon} ${carrier}${route}${date}${ref}`;
}

function matchLine(booking, stay) {
  if (!stay) return `<span style="color:#c06040;">No match found</span>`;
  return `<span style="color:#2e7040;">→ ${stay.flag} ${stay.country} ${stay.start.slice(0,4)}-${stay.start.slice(4,6)}-${stay.start.slice(6,8)} – ${stay.end.slice(4,6)}-${stay.end.slice(6,8)}</span>`;
}

function renderRow(item, index, isMatched) {
  const { booking, stay } = isMatched ? item : { booking: item, stay: null };
  const safe = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const actionBtns = isMatched
    ? `<button class="gmail-btn gmail-accept" data-idx="${index}">✓ Accept</button>
       <button class="gmail-btn gmail-edit"   data-idx="${index}">✎ Edit</button>
       <button class="gmail-btn gmail-dismiss" data-idx="${index}">✕</button>`
    : `<button class="gmail-btn gmail-create" data-idx="${index}">+ Create stay</button>
       <button class="gmail-btn gmail-dismiss" data-idx="${index}">✕</button>`;

  return `<div class="gmail-row" data-idx="${index}" data-matched="${isMatched}">
    <div class="gmail-row-body">
      <div class="gmail-summary">${safe(summaryLine(booking))}</div>
      <div class="gmail-match">${matchLine(booking, stay)}</div>
      <a href="${safe(booking.gmailUrl)}" target="_blank" class="gmail-email-link">View email →</a>
    </div>
    <div class="gmail-row-actions">${actionBtns}</div>
  </div>`;
}

function renderList() {
  const { matched, unmatched } = _currentSuggestions;
  const rows = [
    ...matched.map((item, i) => renderRow(item, i, true)),
    ...unmatched.map((item, i) => renderRow(item, matched.length + i, false)),
  ];
  const list = document.getElementById('gmailSuggestionList');
  const sub  = document.getElementById('gmailDrawerSubtitle');
  const total = matched.length + unmatched.length;
  sub.textContent = `${total} suggestion${total !== 1 ? 's' : ''} — ${matched.length} matched to existing stays, ${unmatched.length} unmatched.`;
  list.innerHTML = rows.join('') || '<p style="padding:12px;color:#9a8070;font-size:11px;">All suggestions reviewed.</p>';
  wireButtons();
}

function wireButtons() {
  const list = document.getElementById('gmailSuggestionList');

  list.querySelectorAll('.gmail-accept').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.idx);
      const item = _currentSuggestions.matched[idx];
      if (!item) return;
      _onAccept('accept', item.booking, item.stay);
    });
  });

  list.querySelectorAll('.gmail-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.idx);
      const item = _currentSuggestions.matched[idx];
      if (!item) return;
      _onAccept('edit', item.booking, item.stay);
    });
  });

  list.querySelectorAll('.gmail-create').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx     = parseInt(btn.dataset.idx);
      const offset  = _currentSuggestions.matched.length;
      const booking = _currentSuggestions.unmatched[idx - offset];
      if (!booking) return;
      _onAccept('create', booking, null);
    });
  });

  list.querySelectorAll('.gmail-dismiss').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx     = parseInt(btn.dataset.idx);
      const { matched, unmatched } = _currentSuggestions;
      const isMatched = idx < matched.length;
      if (isMatched) {
        _currentSuggestions.matched.splice(idx, 1);
      } else {
        _currentSuggestions.unmatched.splice(idx - matched.length, 1);
      }
      renderList();
      _onDismiss();
    });
  });
}

export function openGmailDrawer(suggestions, stays, onAccept, onDismiss) {
  _onAccept  = onAccept;
  _onDismiss = onDismiss;
  _currentSuggestions = {
    matched:   [...suggestions.matched],
    unmatched: [...suggestions.unmatched],
  };
  _currentStays = stays;
  renderList();
  document.getElementById('gmailOverlay').style.display = 'block';
  document.getElementById('gmailDrawer').style.display  = 'block';
  document.getElementById('btnGmailDrawerClose').onclick = closeGmailDrawer;
  document.getElementById('gmailOverlay').onclick        = closeGmailDrawer;
}

export function closeGmailDrawer() {
  document.getElementById('gmailOverlay').style.display = 'none';
  document.getElementById('gmailDrawer').style.display  = 'none';
}

export function updateGmailDrawerStays(stays) {
  if (!_currentSuggestions) return;
  _currentStays = stays;
  // Re-match unmatched bookings against the updated stay list
  const stillUnmatched = [];
  const newlyMatched   = [];
  for (const booking of _currentSuggestions.unmatched) {
    const match = stays.find(s => booking.dateStart >= s.start && booking.dateStart <= s.end);
    if (match) newlyMatched.push({ booking, stay: match });
    else stillUnmatched.push(booking);
  }
  _currentSuggestions.matched.push(...newlyMatched);
  _currentSuggestions.unmatched = stillUnmatched;
  renderList();
}
```

- [ ] **Step 2: Add drawer styles to src/style.css**

Open `src/style.css` and append:

```css
/* Gmail drawer rows */
.gmail-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #e0d8c4;
  font-family: -apple-system, sans-serif;
}
.gmail-row:last-child { border-bottom: none; }
.gmail-row-body { flex: 1; min-width: 0; }
.gmail-summary { font-size: 11px; font-weight: 700; color: #2e2010; margin-bottom: 2px; }
.gmail-match   { font-size: 10px; color: #9a8070; margin-bottom: 3px; }
.gmail-email-link { font-size: 9px; color: #6a8fc0; text-decoration: none; }
.gmail-email-link:hover { text-decoration: underline; }
.gmail-row-actions { display: flex; gap: 5px; flex-shrink: 0; align-items: flex-start; padding-top: 1px; }
.gmail-btn {
  font-size: 9px; padding: 3px 8px; border: none; border-radius: 4px; cursor: pointer;
}
.gmail-accept  { background: #d4e8d0; }
.gmail-edit    { background: #e4dcc8; }
.gmail-dismiss { background: #f0ddd0; }
.gmail-create  { background: #2e2010; color: #f5efe6; }
```

- [ ] **Step 3: Commit**

```bash
git add src/gmail-drawer.js src/style.css
git commit -m "feat: add gmail-drawer.js review UI and styles"
```

---

## Task 8: Update status.js — Gmail notification bar

**Files:**
- Modify: `src/status.js`

- [ ] **Step 1: Rewrite status.js to add the notification bar**

Replace the entire content of `src/status.js`:

```js
import { buildDayMap, dateToYMD, fmtYMD, TODAY, ymdToDate } from './utils.js';

let _lastScanMs = null;
let _gmailState = 'hidden'; // 'hidden' | 'disconnected' | 'scanning' | 'found' | 'uptodate'
let _suggestionCount = 0;
let _onBarClick  = null;
let _onConnect   = null;
let _onRescan    = null;
let _onDismissConnect = null;

export function setGmailBarState(state, opts = {}) {
  _gmailState      = state;
  _suggestionCount = opts.count ?? _suggestionCount;
  _onBarClick      = opts.onBarClick    ?? _onBarClick;
  _onConnect       = opts.onConnect     ?? _onConnect;
  _onRescan        = opts.onRescan      ?? _onRescan;
  _onDismissConnect = opts.onDismissConnect ?? _onDismissConnect;
  if (state === 'uptodate' || state === 'found') _lastScanMs = Date.now();
  renderGmailBar();
}

function timeSince() {
  if (!_lastScanMs) return 'just now';
  const secs = Math.round((Date.now() - _lastScanMs) / 1000);
  if (secs < 60)  return 'just now';
  if (secs < 3600) return `${Math.round(secs/60)} min ago`;
  return `${Math.round(secs/3600)} hr ago`;
}

function renderGmailBar() {
  const bar = document.getElementById('gmailBar');
  if (!bar) return;
  if (_gmailState === 'hidden') { bar.style.display = 'none'; return; }

  bar.style.display = '';
  const rescanBtn = `<span class="gmail-bar-rescan" id="gmailBarRescan">🔄 Rescan</span>`;

  if (_gmailState === 'disconnected') {
    bar.style.cssText = 'background:#f5efe0;border-bottom:1px solid #d4c4a8;padding:0 24px;height:30px;display:flex;align-items:center;gap:10px;font-size:10px;font-family:-apple-system,sans-serif;cursor:pointer;';
    bar.innerHTML = `<span style="color:#6a5030;">📬 Connect Gmail to auto-import bookings</span>
      <button id="gmailConnectBtn" style="font-size:9px;padding:2px 8px;background:#2e2010;color:#f5efe6;border:none;border-radius:4px;cursor:pointer;">Connect</button>
      <span id="gmailDismissConnect" style="margin-left:auto;color:#b0a090;font-size:9px;cursor:pointer;">Not now</span>`;
    document.getElementById('gmailConnectBtn')?.addEventListener('click', () => _onConnect?.());
    document.getElementById('gmailDismissConnect')?.addEventListener('click', () => { _gmailState = 'hidden'; renderGmailBar(); _onDismissConnect?.(); });
    return;
  }

  if (_gmailState === 'scanning') {
    bar.style.cssText = 'background:#f0ead8;border-bottom:1px solid #d4c4a8;padding:0 24px;height:30px;display:flex;align-items:center;gap:10px;font-size:10px;color:#9a8070;font-family:-apple-system,sans-serif;';
    bar.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#c0a030;"></span>Scanning Gmail for bookings…`;
    return;
  }

  if (_gmailState === 'found') {
    bar.style.cssText = 'background:#f0f8f0;border-bottom:1px solid #b8d8b8;padding:0 24px;height:30px;display:flex;align-items:center;gap:10px;font-size:10px;font-family:-apple-system,sans-serif;cursor:pointer;';
    bar.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4a9060;"></span>
      <span style="color:#1a3020;font-weight:600;">${_suggestionCount} booking suggestion${_suggestionCount !== 1 ? 's' : ''} found</span>
      <span style="color:#6a9070;">— click to review</span>
      <span style="margin-left:auto;color:#9a8070;font-size:10px;">Last scanned ${timeSince()} · ${rescanBtn}</span>`;
    bar.onclick = (e) => { if (!e.target.closest('#gmailBarRescan')) _onBarClick?.(); };
    document.getElementById('gmailBarRescan')?.addEventListener('click', (e) => { e.stopPropagation(); _onRescan?.(); });
    return;
  }

  if (_gmailState === 'uptodate') {
    bar.style.cssText = 'background:#ece4d0;border-bottom:1px solid #d4c4a8;padding:0 24px;height:30px;display:flex;align-items:center;gap:10px;font-size:10px;color:#9a8070;font-family:-apple-system,sans-serif;';
    bar.innerHTML = `<span>✓ Gmail up to date</span>
      <span style="margin-left:auto;font-size:10px;">Last scanned ${timeSince()} · ${rescanBtn}</span>`;
    document.getElementById('gmailBarRescan')?.addEventListener('click', () => _onRescan?.());
  }
}

export function renderStatus(stays, events) {
  const { dayMap } = buildDayMap(stays, events);
  const todayKey = dateToYMD(TODAY);
  const t = dayMap[todayKey];
  const unbooked = stays.filter(s => !s.booked).length;
  const nextUnbooked = stays.find(s => !s.booked && ymdToDate(s.start) >= TODAY);
  const todayStr = t ? `${t.flag} ${t.label}` : 'no trip';
  document.getElementById('statusLine').innerHTML =
    `<span>Today: ${todayStr}</span>` +
    `<span class="unbooked">● ${unbooked} still to book</span>` +
    (nextUnbooked ? `<span>Next unbooked: ${nextUnbooked.flag} ${nextUnbooked.label} (${fmtYMD(nextUnbooked.start)})</span>` : '');
}
```

- [ ] **Step 2: Add gmail-bar-rescan style to style.css**

Append to `src/style.css`:

```css
.gmail-bar-rescan {
  cursor: pointer;
  text-decoration: underline;
  color: inherit;
}
.gmail-bar-rescan:hover { opacity: 0.7; }
```

- [ ] **Step 3: Commit**

```bash
git add src/status.js src/style.css
git commit -m "feat: add Gmail notification bar with 4 states to status.js"
```

---

## Task 9: Update main.js — wire Gmail scan and drawer

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add imports**

In `src/main.js`, add to the import block:

```js
import { getGmailAccessToken } from './auth.js';
import { scanGmail } from './gmail.js';
import { openGmailDrawer, closeGmailDrawer, updateGmailDrawerStays } from './gmail-drawer.js';
import { setGmailBarState } from './status.js';
import { openGmailPreFill } from './editor.js';
```

- [ ] **Step 2: Add `suggestions` module-level state**

After `let events = [];` in `src/main.js`, add:

```js
let suggestions = null; // { matched: [], unmatched: [], lastMessageId }
```

- [ ] **Step 3: Add `runGmailScan` function**

After the `loadAndRender` function in `src/main.js`, add:

```js
async function runGmailScan() {
  setGmailBarState('scanning');
  try {
    const token = await getGmailAccessToken();
    if (!token) {
      setGmailBarState('disconnected', {
        onConnect: signInWithGoogle,
        onDismissConnect: () => {},
      });
      return;
    }
    suggestions = await scanGmail(token, stays);
    const count = suggestions.matched.length + suggestions.unmatched.length;
    if (count > 0) {
      setGmailBarState('found', {
        count,
        onBarClick: openDrawer,
        onRescan: runGmailScan,
      });
    } else {
      setGmailBarState('uptodate', { onRescan: runGmailScan });
    }
  } catch (err) {
    if (err.code === 'NO_GMAIL_SCOPE') {
      setGmailBarState('disconnected', {
        onConnect: signInWithGoogle,
        onDismissConnect: () => {},
      });
    } else {
      console.error('Gmail scan error:', err);
      setGmailBarState('hidden');
    }
  }
}
```

- [ ] **Step 4: Add `openDrawer` function**

After `runGmailScan`, add:

```js
function openDrawer() {
  if (!suggestions) return;
  openGmailDrawer(
    suggestions,
    stays,
    async (action, booking, stay) => {
      if (action === 'accept') {
        const merged = mergeBookingIntoStay(booking, stay);
        await saveTrip(merged);
        await loadAndRender();
        suggestions.matched = suggestions.matched.filter(m => m.booking !== booking);
        updateGmailDrawerStays(stays);
        const count = suggestions.matched.length + suggestions.unmatched.length;
        if (count > 0) setGmailBarState('found', { count, onBarClick: openDrawer, onRescan: runGmailScan });
        else { setGmailBarState('uptodate', { onRescan: runGmailScan }); closeGmailDrawer(); }
      } else if (action === 'edit') {
        closeGmailDrawer();
        openGmailPreFill(booking, stay);
      } else if (action === 'create') {
        closeGmailDrawer();
        openPopupNew(null, booking.dateStart);
      }
    },
    () => {
      const count = suggestions.matched.length + suggestions.unmatched.length;
      if (count === 0) { setGmailBarState('uptodate', { onRescan: runGmailScan }); }
    },
  );
}
```

- [ ] **Step 5: Add `mergeBookingIntoStay` helper**

After `openDrawer`, add:

```js
function mergeBookingIntoStay(booking, stay) {
  if (booking.type === 'flight') {
    const leg = booking.inbound;
    const isInbound = leg && stay.country && airportCountry(leg.destination) === stay.country;
    const flightObj = leg
      ? { number: `${leg.carrier} ${leg.ref}`, booking_ref: booking.ref, confirmed: null, source: 'gmail' }
      : null;
    return {
      ...stay,
      flight_in:  isInbound  ? (flightObj ?? stay.flight_in)  : stay.flight_in,
      flight_out: !isInbound ? (flightObj ?? stay.flight_out) : stay.flight_out,
    };
  }
  if (booking.type === 'accommodation') {
    return {
      ...stay,
      accom: {
        name: booking.inbound?.carrier || '',
        address: '',
        booking_ref: booking.ref,
        booked: null,
        source: 'gmail',
      },
    };
  }
  return stay;
}
```

Note: `airportCountry` is defined inside `gmail.js` — import it or duplicate a small version here:

```js
// Minimal duplicate to avoid circular import
const AIRPORT_COUNTRY_MAIN = {
  MAD:'Spain',BCN:'Spain',AGP:'Spain',ALC:'Spain',PMI:'Spain',SVQ:'Spain',VLC:'Spain',
  DUB:'Ireland',ORK:'Ireland',SNN:'Ireland',
  LHR:'UK',LGW:'UK',LTN:'UK',STN:'UK',
  CDG:'France',FCO:'Italy',LIS:'Portugal',OPO:'Portugal',BKK:'Thailand',
};
function airportCountry(iata) { return AIRPORT_COUNTRY_MAIN[iata?.toUpperCase()] ?? null; }
```

- [ ] **Step 6: Trigger the scan after login**

In `src/main.js`, in the `boot` function, update the `if (session)` block:

```js
  if (session) {
    showApp();
    await loadAndRender();
    runGmailScan();
  }
```

And update the `onAuthChange` callback:

```js
  onAuthChange(async session => {
    if (session) {
      showApp();
      await loadAndRender();
      runGmailScan();
    } else {
      showAuthGate();
    }
  });
```

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: wire Gmail scan on login with notification bar and review drawer"
```

---

## Task 10: Push and smoke-test

**Files:**
- No code changes — verification only

- [ ] **Step 1: Push to main**

```bash
git push
```

- [ ] **Step 2: Open the app and check the notification bar**

Navigate to `https://lagar23.github.io/travel-tracker/` and sign in.

Expected:
1. Bar shows amber "Scanning Gmail for bookings…" briefly
2. Either transitions to green "N booking suggestions found" or beige "✓ Gmail up to date"
3. If it shows "Connect Gmail" — the existing session lacks Gmail scope; sign out and sign back in (the new scope will be requested)

- [ ] **Step 3: Sign out and sign back in if needed**

If the bar shows "Connect Gmail", click Connect. The Google consent screen should now include Gmail read-only permission.

- [ ] **Step 4: Test the drawer**

Click the green bar (if suggestions found). Verify:
- Each suggestion row shows summary + match line + "View email" link
- Accept merges data and row disappears
- Dismiss removes the row
- Create Stay opens the new-stay popup
- Rescan button triggers a fresh scan

- [ ] **Step 5: Test the dual checkboxes**

Open any stay popup. Verify:
- Two checkboxes: "✈️ Transportation booked" and "🏠 Stay booked"
- Saving correctly persists both flags
- Red unbooked dot on calendar reflects `!(booked_transportation && booked_stay)`

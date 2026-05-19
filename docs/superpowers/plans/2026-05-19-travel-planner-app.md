# Travel Planner App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the single-file localStorage travel planner to a Supabase-backed app with Google OAuth, vanilla JS modules, and per-user data isolation via Row Level Security.

**Architecture:** Browser talks directly to Supabase using the JS SDK loaded via CDN. Auth is Google OAuth handled by Supabase. All Supabase access is gated behind RLS policies so each user only ever reads and writes their own rows. No server, no build step — deployed to GitHub Pages as static files.

**Tech Stack:** Supabase JS SDK v2 (CDN), vanilla ES modules, GitHub Pages, Google OAuth via Supabase

---

## Prerequisites (manual steps before Task 1)

These require clicking in browser UIs — do them once before starting:

1. **Create a Supabase project** at supabase.com (free tier). Note the **Project URL** and **anon public key** from Settings → API.
2. **Enable Google OAuth** in Supabase: Authentication → Providers → Google → toggle on. You'll need a Google Cloud OAuth 2.0 client ID + secret (create at console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client IDs, type "Web application"). Add `https://<your-project>.supabase.co/auth/v1/callback` as an Authorised redirect URI.
3. **Note your GitHub Pages URL** — either `https://lagar23.github.io/travel-tracker` or a custom domain. Add it to Supabase: Authentication → URL Configuration → Site URL.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `index.html` | Modify | App shell: loads modules, shows auth gate or calendar |
| `config.js` | Create | Supabase URL + anon key (safe to commit) |
| `src/style.css` | Create | All CSS moved from `index.html` verbatim |
| `src/auth.js` | Create | Google OAuth, session, `getSession()`, `onAuthChange()` |
| `src/db.js` | Create | All Supabase CRUD — `getTrips()`, `saveTrip()`, `getEvents()`, `saveEvent()`, `deleteTrip()`, `deleteEvent()` |
| `src/utils.js` | Create | Date helpers, uid, constants — moved from `index.html` |
| `src/calendar.js` | Create | Calendar render logic — ported from `index.html`, receives data as argument |
| `src/editor.js` | Create | Popup + drawer logic — ported from `index.html` |
| `src/status.js` | Create | Status bar render — ported from `index.html` |
| `src/main.js` | Create | Boot: checks auth, loads data, wires up all modules |
| `migrate/migrate.js` | Create | One-time script: reads exported JSON, inserts into Supabase |
| `.github/workflows/deploy.yml` | Create | GitHub Action: deploy to Pages on push to main |

---

## Task 1: Project scaffold + config

**Files:**
- Create: `config.js`
- Create: `src/style.css`
- Modify: `index.html`

- [ ] **Step 1: Create `config.js`**

```js
// Replace these values with your Supabase project's URL and anon key
// (Settings → API in the Supabase dashboard)
export const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON = 'YOUR_ANON_KEY';
```

- [ ] **Step 2: Create `src/` directory and move CSS**

Create `src/style.css` by cutting everything between `<style>` and `</style>` out of `index.html` and pasting it into `src/style.css` verbatim. No changes to the CSS itself.

- [ ] **Step 3: Rewrite `index.html` to the app shell**

Replace the entire contents of `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>2026 Travel</title>
<link rel="stylesheet" href="src/style.css">
</head>
<body>

<!-- AUTH GATE (shown when logged out) -->
<div id="authGate" style="display:none; position:fixed; inset:0; background:#e8e0cc;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; z-index:200;">
  <span style="font-family:Georgia,serif; font-size:28px; font-weight:700; color:#1e1408;">2026 Travel</span>
  <button id="btnSignIn" style="background:#2e2010; color:#f5efe6; font-size:13px; border:none;
    border-radius:8px; padding:10px 22px; cursor:pointer; font-family:-apple-system,sans-serif; font-weight:600;">
    Sign in with Google
  </button>
</div>

<!-- APP (shown when logged in) -->
<div id="app" style="display:none;">
  <div class="header">
    <span class="header-title">2026 Travel</span>
    <div class="nav-group">
      <button class="nav-arrow" id="btnPrev">‹</button>
      <div class="nav-label" id="navLabel"></div>
      <button class="nav-arrow" id="btnNext">›</button>
      <button class="btn-today" id="btnToday">Today</button>
      <div class="nav-divider"></div>
      <button class="mcbtn" data-n="3">3</button>
      <button class="mcbtn active" data-n="6">6</button>
      <button class="mcbtn" data-n="9">9</button>
      <button class="mcbtn" data-n="12">Year</button>
    </div>
    <div class="header-actions">
      <button class="btn btn-edit" id="btnExport">⬇ Export</button>
      <button class="btn btn-edit" id="btnImportTrigger">⬆ Import</button>
      <input type="file" id="importFile" accept=".json" style="display:none">
      <button class="btn btn-edit" id="btnSignOut">Sign out</button>
      <button class="btn btn-edit" id="btnEditDrawer">✏️ Edit</button>
      <button class="btn btn-add" id="btnAdd">＋ Add</button>
    </div>
  </div>

  <div class="status-bar" id="statusLine"></div>

  <div class="cal-surface">
    <div class="year-grid" id="yearGrid"></div>
  </div>

  <div class="summary">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
      <h3 style="margin-bottom:0;">Days per country —</h3>
      <button id="btnSummaryPrev" style="background:none;border:none;cursor:pointer;font-size:13px;color:#9a8070;padding:0 2px;line-height:1;">‹</button>
      <span id="summaryYearLabel" style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#a09070;font-family:-apple-system,sans-serif;"></span>
      <button id="btnSummaryNext" style="background:none;border:none;cursor:pointer;font-size:13px;color:#9a8070;padding:0 2px;line-height:1;">›</button>
    </div>
    <div class="country-grid" id="countryGrid"></div>
  </div>

  <div class="legend">
    <span><span class="ls" style="background:#bccde2;"></span>Spain (blues)</span>
    <span><span class="ls" style="background:#b8dfc2;"></span>Ireland (greens)</span>
    <span><span class="ls" style="background:#e8cda4;"></span>Thailand</span>
    <span><span class="ls" style="background:#cac6de;"></span>Canada</span>
    <span><span class="ls" style="background:#ead8a4;"></span>Portugal</span>
    <span><span class="ls" style="background:#d6bca4;"></span>Kazakhstan</span>
    <span><span class="ls" style="background:#f0cadc;"></span>Italy</span>
    <span style="opacity:0.5;display:inline-flex;align-items:center;"><span class="ls" style="background:#b8dfc2;"></span>past</span>
    <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:5px;height:5px;background:#d94040;border-radius:50%;"></span>unbooked</span>
    <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:24px;height:10px;background:#9b6b8a;border-radius:2px;opacity:0.9;"></span>event</span>
  </div>

  <!-- POPUP -->
  <div class="popup-overlay" id="popupOverlay"></div>
  <div class="popup" id="popup" onclick="event.stopPropagation()">
    <div class="popup-header">
      <span class="date-label" id="popupDateLabel"></span>
      <button class="popup-close" id="btnPopupClose">✕</button>
    </div>
    <div class="toggle-tabs">
      <button class="tab active" id="tabStay">🏠 Stay</button>
      <button class="tab" id="tabEvent">📅 Event</button>
    </div>
    <div id="stayFields">
      <div class="inner-tabs">
        <button class="inner-tab active" id="stayTabInfo">📋 Info</button>
        <button class="inner-tab" id="stayTabFlight">✈️ Flight</button>
        <button class="inner-tab" id="stayTabAccom">🏨 Stay</button>
        <button class="inner-tab" id="stayTabNotes">📝 Notes</button>
      </div>
      <div id="stayPanelInfo">
        <div class="field"><label>Country</label>
          <select id="pCountry">
            <option value="Spain|🇪🇸">🇪🇸 Spain</option>
            <option value="Ireland|🇮🇪">🇮🇪 Ireland</option>
            <option value="Thailand|🇹🇭">🇹🇭 Thailand</option>
            <option value="Portugal|🇵🇹">🇵🇹 Portugal</option>
            <option value="Italy|🇮🇹">🇮🇹 Italy</option>
            <option value="Kazakhstan|🇰🇿">🇰🇿 Kazakhstan</option>
            <option value="UK|🇬🇧">🇬🇧 UK</option>
            <option value="USA|🇺🇸">🇺🇸 USA</option>
            <option value="Canada|🇨🇦">🇨🇦 Canada</option>
          </select>
        </div>
        <div class="field"><label>Location</label><input type="text" id="pLabel" placeholder="e.g. Villa, Megan's…"></div>
        <div class="field-row">
          <div class="field"><label>Start</label><input type="text" id="pStart" placeholder="YYYY/MM/DD"></div>
          <div class="field"><label>End</label><input type="text" id="pEnd" placeholder="YYYY/MM/DD"></div>
        </div>
        <div class="field"><label>Note</label><input type="text" id="pNote" placeholder="e.g. 🎵 Sonorama, passport…"></div>
        <div class="field" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="pBooked" style="width:auto;">
          <label for="pBooked" style="font-size:11px;text-transform:none;letter-spacing:0;color:#3d2b1f;">Booked</label>
        </div>
      </div>
      <div id="stayPanelFlight" style="display:none;">
        <div class="field"><label>Inbound flight</label><input type="text" id="pFlightIn" placeholder="e.g. IB 3456, 08:30 MAD→DUB"></div>
        <div class="field"><label>Inbound confirmation</label><input type="text" id="pFlightInRef" placeholder="Booking ref or URL"></div>
        <div class="field" style="margin-top:4px;"><label>Outbound flight</label><input type="text" id="pFlightOut" placeholder="e.g. FR 9012, 19:45 DUB→MAD"></div>
        <div class="field"><label>Outbound confirmation</label><input type="text" id="pFlightOutRef" placeholder="Booking ref or URL"></div>
      </div>
      <div id="stayPanelAccom" style="display:none;">
        <div class="field"><label>Accommodation name</label><input type="text" id="pAccomName" placeholder="e.g. Airbnb Lisbon, Hotel Arts…"></div>
        <div class="field"><label>Address</label><input type="text" id="pAccomAddr" placeholder="Street / area"></div>
        <div class="field"><label>Confirmation / URL</label><input type="text" id="pAccomRef" placeholder="Booking ref or link" id="pAccomRefInput"></div>
        <div id="pAccomLink" style="display:none;margin-bottom:8px;"><a id="pAccomLinkA" href="#" target="_blank" style="font-size:10px;color:#6a8fc0;text-decoration:none;">🔗 Open link</a></div>
      </div>
      <div id="stayPanelNotes" style="display:none;">
        <div class="field"><label>Trip notes</label>
          <textarea id="pTripNotes" rows="7" placeholder="Itinerary ideas, packing list, reminders…" style="width:100%;font-size:11px;font-family:inherit;border:1px solid #d4c8bc;border-radius:5px;padding:5px 7px;background:#fff;color:#3d2b1f;resize:vertical;"></textarea>
        </div>
      </div>
    </div>
    <div id="eventFields" style="display:none;">
      <div class="field"><label>Event name</label><input type="text" id="pEventLabel" placeholder="e.g. 💍 John, Planeta Sound"></div>
      <div class="field-row">
        <div class="field"><label>Start</label><input type="text" id="pEventStart" placeholder="YYYY/MM/DD"></div>
        <div class="field"><label>End</label><input type="text" id="pEventEnd" placeholder="YYYY/MM/DD"></div>
      </div>
      <div class="field"><label>Colour</label>
        <div class="color-row" id="colorSwatches">
          <div class="swatch picked" style="background:#9b6b8a;" data-color="#9b6b8a"></div>
          <div class="swatch" style="background:#c2785a;" data-color="#c2785a"></div>
          <div class="swatch" style="background:#7a9e6e;" data-color="#7a9e6e"></div>
          <div class="swatch" style="background:#6a8fc0;" data-color="#6a8fc0"></div>
          <div class="swatch" style="background:#c0a030;" data-color="#c0a030"></div>
          <div class="swatch" style="background:#a05050;" data-color="#a05050"></div>
          <input type="color" id="customColor" style="width:18px;height:18px;border-radius:50%;border:none;padding:0;cursor:pointer;background:none;" value="#9b6b8a">
        </div>
      </div>
      <div class="field"><label>Note / URL</label><input type="text" id="pEventNote" placeholder="Link, venue, notes…"></div>
      <div class="event-note-link" id="pEventNoteLink" style="display:none;margin-bottom:8px;">
        <a id="pEventNoteLinkA" href="#" target="_blank" style="font-size:10px;color:#6a8fc0;text-decoration:none;">🔗 Open link</a>
      </div>
    </div>
    <div class="popup-actions" id="popupActions">
      <button class="btn btn-delete" id="btnDelete" style="display:none;">Delete</button>
      <button class="btn" id="btnSave">Save</button>
    </div>
  </div>

  <!-- EDIT DRAWER -->
  <div class="edit-overlay" id="editOverlay"></div>
  <div class="edit-drawer" id="editDrawer" onclick="event.stopPropagation()">
    <div class="drawer-header">
      <h2>Edit Stays &amp; Events</h2>
      <button class="popup-close" id="btnDrawerClose">✕</button>
    </div>
    <p class="drawer-subtitle">Past stays are locked. Future stays and all events are editable.</p>
    <div class="drawer-section-title">Stays</div>
    <table class="trip-table">
      <thead><tr><th>Location</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
      <tbody id="tripBody"></tbody>
    </table>
    <div class="drawer-section-title">Events</div>
    <table class="trip-table">
      <thead><tr><th>Event</th><th>Start</th><th>End</th><th>Note / URL</th></tr></thead>
      <tbody id="eventBody"></tbody>
    </table>
    <button class="save-btn" id="btnDrawerSave">Save &amp; close</button>
  </div>
</div>

<script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify the file renders without JS errors**

Open `index.html` in a browser (File → Open). The auth gate div should show. Open DevTools console — no errors expected at this point (modules not loaded yet is fine).

- [ ] **Step 5: Commit**

```bash
git add index.html config.js src/style.css
git commit -m "feat: scaffold app shell, extract CSS, add config stub"
```

---

## Task 2: Utilities module

**Files:**
- Create: `src/utils.js`

Extract all pure helper functions and constants from `index.html`. This module has no dependencies.

- [ ] **Step 1: Create `src/utils.js`**

```js
export const TODAY = new Date();
TODAY.setHours(0,0,0,0);

export const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

export const DOT_COLORS = {
  'c-villa':'#b8c9e0','c-gijon':'#8aacc8','c-madrid':'#ccd9ed','c-bilbao':'#9ab4d0',
  'c-santander':'#a8ccd8','c-aranda':'#7898b8','c-avila':'#c0cfe0',
  'c-ireland':'#b8dec0','c-megans':'#9acc9e',
  'c-thailand':'#e8c9a0','c-london':'#c9b8e0','c-italy':'#f0c8d8',
  'c-boston':'#c8d4b8','c-toronto':'#c8c4dc','c-portugal':'#e8d8a0','c-kazakhstan':'#d4b8a0',
};

export const COUNTRY_CSS = {
  'Spain':'c-villa','Ireland':'c-ireland','Thailand':'c-thailand','Portugal':'c-portugal',
  'Italy':'c-italy','Kazakhstan':'c-kazakhstan','UK':'c-london','USA':'c-boston','Canada':'c-toronto',
};

export const COUNTRY_FLAGS = {
  "Spain":"🇪🇸","Ireland":"🇮🇪","Thailand":"🇹🇭","Toronto":"🇨🇦","Kazakhstan":"🇰🇿",
  "Portugal":"🇵🇹","Italy":"🇮🇹","Boston":"🇺🇸","London":"🇬🇧","Canada":"🇨🇦","USA":"🇺🇸","UK":"🇬🇧",
};

export function uid() { return Math.random().toString(36).slice(2,10); }

// YYYYMMDD ↔ Date
export function ymdToDate(s) {
  return new Date(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8));
}
export function dateToYMD(d) {
  return String(d.getFullYear()) +
    String(d.getMonth()+1).padStart(2,'0') +
    String(d.getDate()).padStart(2,'0');
}

// Display format: YYYY/MM/DD
export function fmtYMD(s) { return s.slice(0,4)+'/'+s.slice(4,6)+'/'+s.slice(6,8); }
export function parseYMD(s) { return s.replace(/\//g,''); }

export function calKey(year, month, day) {
  return String(year) + String(month+1).padStart(2,'0') + String(day).padStart(2,'0');
}
export function daysInMonth(year, month) {
  return new Date(year, month+1, 0).getDate();
}
export function firstDOW(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0
}

export function buildDayMap(stays, events) {
  const dayMap = {}, eventMap = {};
  stays.forEach(stay => {
    let d = ymdToDate(stay.start);
    const e = ymdToDate(stay.end);
    let isFirst = true;
    while (d < e) {
      const key = dateToYMD(d);
      if (!dayMap[key]) dayMap[key] = { ...stay, isFirst };
      isFirst = false;
      d.setDate(d.getDate()+1);
    }
  });
  events.forEach(ev => {
    let d = ymdToDate(ev.start);
    const e = ymdToDate(ev.end);
    let isFirst = true;
    while (d <= e) {
      const key = dateToYMD(d);
      if (!eventMap[key]) eventMap[key] = [];
      eventMap[key].push({ ...ev, isFirst });
      isFirst = false;
      d.setDate(d.getDate()+1);
    }
  });
  return { dayMap, eventMap };
}

// Derive whether a trip is booked from its booking refs / confirmed overrides
export function isTripBooked(trip) {
  function legBooked(leg) {
    if (!leg) return true; // no leg = not applicable = doesn't block
    if (leg.confirmed !== null && leg.confirmed !== undefined) return leg.confirmed;
    return !!leg.booking_ref;
  }
  function accomBooked(accom) {
    if (!accom) return true;
    if (accom.booked !== null && accom.booked !== undefined) return accom.booked;
    return !!accom.booking_ref;
  }
  // Legacy flat fields (current app) — fall back to explicit booked flag
  if (trip.booked !== undefined && !trip.flight_in && !trip.flight_out && !trip.accom) {
    return trip.booked;
  }
  return legBooked(trip.flight_in) && legBooked(trip.flight_out) && accomBooked(trip.accom);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils.js
git commit -m "feat: extract utils module (date helpers, constants, buildDayMap)"
```

---

## Task 3: Auth module

**Files:**
- Create: `src/auth.js`

- [ ] **Step 1: Create `src/auth.js`**

```js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON } from '../config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export function getSupabase() { return supabase; }

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth.js
git commit -m "feat: add auth module (Google OAuth via Supabase)"
```

---

## Task 4: Database schema in Supabase

Manual step — run this SQL in the Supabase SQL editor (Database → SQL Editor → New query):

- [ ] **Step 1: Create trips table**

```sql
create table trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  country     text not null,
  flag        text not null default '',
  css_class   text not null default 'c-villa',
  start_date  date not null,
  end_date    date not null,
  note        text not null default '',
  source      text not null default 'manual',
  booking_ref text,
  provider    text,
  flight_in   jsonb,
  flight_out  jsonb,
  accom       jsonb,
  created_at  timestamptz default now()
);
```

- [ ] **Step 2: Create events table**

```sql
create table events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  start_date  date not null,
  end_date    date not null,
  color       text not null default '#9b6b8a',
  note        text not null default '',
  trip_id     uuid references trips(id) on delete set null,
  source      text not null default 'manual',
  booking_ref text,
  created_at  timestamptz default now()
);
```

- [ ] **Step 3: Enable RLS and add policies**

```sql
-- Enable RLS
alter table trips  enable row level security;
alter table events enable row level security;

-- trips policies
create policy "trips: own rows only" on trips
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- events policies
create policy "events: own rows only" on events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 4: Verify in Supabase Table Editor**

Open Table Editor → trips and events tables should exist with columns listed above. RLS should show as enabled (padlock icon).

---

## Task 5: Database module

**Files:**
- Create: `src/db.js`

All Supabase queries live here. The rest of the app calls these functions and never imports from `@supabase/supabase-js` directly.

The current app uses `YYYYMMDD` strings for dates. Supabase uses ISO date strings (`YYYY-MM-DD`). This module converts in both directions so the rest of the app stays unchanged.

- [ ] **Step 1: Create `src/db.js`**

```js
import { getSupabase } from './auth.js';

// YYYYMMDD → YYYY-MM-DD (for Supabase)
function toIso(ymd) {
  return ymd.slice(0,4) + '-' + ymd.slice(4,6) + '-' + ymd.slice(6,8);
}
// YYYY-MM-DD → YYYYMMDD (for app)
function fromIso(iso) {
  return iso.replace(/-/g,'');
}

function tripToApp(row) {
  return {
    id:       row.id,
    type:     'stay',
    label:    row.label,
    country:  row.country,
    flag:     row.flag,
    cssClass: row.css_class,
    start:    fromIso(row.start_date),
    end:      fromIso(row.end_date),
    note:     row.note,
    source:   row.source,
    booking_ref: row.booking_ref,
    provider: row.provider,
    flight_in:  row.flight_in,
    flight_out: row.flight_out,
    accom:    row.accom,
    // derive booked for backwards compat with calendar render
    booked: row.flight_in || row.flight_out || row.accom
      ? (legBooked(row.flight_in) && legBooked(row.flight_out) && accomBooked(row.accom))
      : false,
  };
}

function legBooked(leg) {
  if (!leg) return true;
  if (leg.confirmed !== null && leg.confirmed !== undefined) return leg.confirmed;
  return !!leg.booking_ref;
}
function accomBooked(accom) {
  if (!accom) return true;
  if (accom.booked !== null && accom.booked !== undefined) return accom.booked;
  return !!accom.booking_ref;
}

function eventToApp(row) {
  return {
    id:      row.id,
    type:    'event',
    label:   row.label,
    start:   fromIso(row.start_date),
    end:     fromIso(row.end_date),
    color:   row.color,
    note:    row.note,
    trip_id: row.trip_id,
    source:  row.source,
  };
}

export async function getTrips() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('trips')
    .select('*')
    .order('start_date');
  if (error) throw error;
  return data.map(tripToApp);
}

export async function saveTrip(trip) {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  const row = {
    user_id:    session.user.id,
    label:      trip.label,
    country:    trip.country,
    flag:       trip.flag,
    css_class:  trip.cssClass,
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
  if (trip.id) {
    const { error } = await sb.from('trips').update(row).eq('id', trip.id);
    if (error) throw error;
  } else {
    const { data, error } = await sb.from('trips').insert(row).select().single();
    if (error) throw error;
    return data.id;
  }
}

export async function deleteTrip(id) {
  const sb = getSupabase();
  const { error } = await sb.from('trips').delete().eq('id', id);
  if (error) throw error;
}

export async function getEvents() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('events')
    .select('*')
    .order('start_date');
  if (error) throw error;
  return data.map(eventToApp);
}

export async function saveEvent(event) {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  const row = {
    user_id:    session.user.id,
    label:      event.label,
    start_date: toIso(event.start),
    end_date:   toIso(event.end),
    color:      event.color,
    note:       event.note || '',
    trip_id:    event.trip_id || null,
    source:     event.source || 'manual',
  };
  if (event.id) {
    const { error } = await sb.from('events').update(row).eq('id', event.id);
    if (error) throw error;
  } else {
    const { data, error } = await sb.from('events').insert(row).select().single();
    if (error) throw error;
    return data.id;
  }
}

export async function deleteEvent(id) {
  const sb = getSupabase();
  const { error } = await sb.from('events').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db.js
git commit -m "feat: add db module (Supabase CRUD for trips and events)"
```

---

## Task 6: Status bar module

**Files:**
- Create: `src/status.js`

- [ ] **Step 1: Create `src/status.js`**

```js
import { buildDayMap, dateToYMD, fmtYMD, TODAY } from './utils.js';

export function renderStatus(stays, events) {
  const { dayMap } = buildDayMap(stays, events);
  const todayKey = dateToYMD(TODAY);
  const t = dayMap[todayKey];
  const unbooked = stays.filter(s => !s.booked).length;
  const nextUnbooked = stays.find(s => !s.booked && new Date(s.start.slice(0,4), +s.start.slice(4,6)-1, +s.start.slice(6,8)) >= TODAY);
  const todayStr = t ? `${t.flag} ${t.label}` : 'no trip';
  document.getElementById('statusLine').innerHTML =
    `<span>Today: ${todayStr}</span>` +
    `<span class="unbooked">● ${unbooked} still to book</span>` +
    (nextUnbooked ? `<span>Next unbooked: ${nextUnbooked.flag} ${nextUnbooked.label} (${fmtYMD(nextUnbooked.start)})</span>` : '');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/status.js
git commit -m "feat: add status bar module"
```

---

## Task 7: Calendar module

**Files:**
- Create: `src/calendar.js`

Port the `renderCalendar`, `renderSummary`, `shiftSummaryYear`, and `renderNav` functions from `index.html`. They now receive data as arguments instead of reading from a global `DATA` object.

- [ ] **Step 1: Create `src/calendar.js`**

```js
import {
  TODAY, MONTHS, COUNTRY_FLAGS, DOT_COLORS,
  buildDayMap, calKey, daysInMonth, firstDOW, fmtYMD, ymdToDate
} from './utils.js';

let summaryYear = null;

export function renderNav(viewYear, viewMonth, viewMonths) {
  let label;
  if (viewMonths === 12) {
    label = String(viewYear);
  } else {
    const endAbsMonth = viewMonth + viewMonths - 1;
    const endYear  = viewYear + Math.floor(endAbsMonth / 12);
    const endMonth = endAbsMonth % 12;
    const startStr = MONTHS[viewMonth].slice(0,3) + ' ' + viewYear;
    const endStr   = MONTHS[endMonth].slice(0,3) + ' ' + endYear;
    label = startStr + ' – ' + endStr;
  }
  document.getElementById('navLabel').textContent = label;
}

export function renderCalendar(stays, events, viewYear, viewMonth, viewMonths, onDayClick, onEventBarClick) {
  const { dayMap, eventMap } = buildDayMap(stays, events);
  const grid = document.getElementById('yearGrid');
  grid.innerHTML = '';
  const cols = viewMonths === 12 ? 4 : 3;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const styleId = 'dynamic-cal-style';
  let dynStyle = document.getElementById(styleId);
  if (!dynStyle) { dynStyle = document.createElement('style'); dynStyle.id = styleId; document.head.appendChild(dynStyle); }
  dynStyle.textContent = `.month-block:nth-child(-n+${cols}) .month-name { padding-top: 0; } .month-block:nth-child(n+${cols+1}) { border-top: 1px solid #e0d8c4; }`;

  let prevCountry = null;
  const showFlag = {};
  Object.keys(dayMap).sort().forEach(key => {
    const t = dayMap[key];
    if (t && t.isFirst) {
      showFlag[key] = t.country !== prevCountry;
      prevCountry = t.country;
    }
  });

  for (let mi = 0; mi < viewMonths; mi++) {
    const absMonth = viewMonth + mi;
    const year  = viewYear + Math.floor(absMonth / 12);
    const month = absMonth % 12;

    const block = document.createElement('div');
    block.className = 'month-block';

    const off = firstDOW(year, month);
    const dim = daysInMonth(year, month);
    const slots = [];
    for (let i=0; i<off; i++) slots.push(null);
    for (let d=1; d<=dim; d++) slots.push(d);
    while (slots.length % 7 !== 0) slots.push(null);
    const weeks = [];
    for (let i=0; i<slots.length; i+=7) weeks.push(slots.slice(i,i+7));

    let html = `<div class="month-name">${MONTHS[month]} ${year}</div>
    <div class="dow-row"><div class="dow">M</div><div class="dow">T</div><div class="dow">W</div><div class="dow">T</div><div class="dow">F</div><div class="dow">S</div><div class="dow">S</div></div>`;

    weeks.forEach(week => {
      const seenByRow = [new Set(), new Set()];
      const weekEvents = [];
      week.forEach((day, col) => {
        if (!day) return;
        const key = calKey(year, month, day);
        const evList = eventMap[key] || [];
        evList.forEach(ev => {
          let row = -1;
          for (let r = 0; r < seenByRow.length; r++) {
            if (seenByRow[r].has(ev.id)) { row = r; break; }
          }
          if (row === -1) {
            for (let r = 0; r < seenByRow.length; r++) {
              if (!seenByRow[r].has(ev.id)) { row = r; break; }
            }
            if (row === -1) return;
            let span = 0;
            for (let c = col; c < 7; c++) {
              const d2 = week[c]; if (!d2) break;
              const k2 = calKey(year, month, d2);
              if ((eventMap[k2]||[]).some(e2 => e2.id === ev.id)) span++;
              else break;
            }
            weekEvents.push({ startCol: col, span, row, label: ev.label, color: ev.color, id: ev.id, startKey: key });
            seenByRow[row].add(ev.id);
          }
        });
      });

      html += `<div class="week-wrap">`;
      week.forEach(day => {
        if (!day) { html += `<div class="d empty"></div>`; return; }
        const key = calKey(year, month, day);
        const date = new Date(year, month, day);
        const past = date < TODAY;
        const isToday = date.getTime() === TODAY.getTime();
        const t = dayMap[key];
        const cls = 'd' + (past?' past':'') + (isToday?' today':'') + ' ' + (t ? t.cssClass : 'notrip');
        const needsPin = t && t.isFirst && !t.booked;
        const flag = (t && t.isFirst && showFlag[key]) ? `${t.flag} ` : '';
        const locStr = (t && t.isFirst) ? `${flag}${t.label}` : '';
        let inner = `<div class="d-num-row">${needsPin?'<span class="d-pin"></span>':''}<span class="d-num">${day}</span>${locStr ? `<span class="d-loc">${locStr}</span>` : ''}</div>`;
        if (t && t.isFirst && t.note) {
          const isUrl = t.note.startsWith('http://') || t.note.startsWith('https://');
          inner += `<span class="d-note">${isUrl ? '🔗' : t.note}</span>`;
        }
        html += `<div class="${cls}" data-key="${key}">${inner}</div>`;
      });

      weekEvents.forEach(ev => {
        const leftPct = (ev.startCol/7*100).toFixed(2);
        const widthPct = (ev.span/7*100).toFixed(2);
        const rowCls = ev.row === 1 ? ' row2' : '';
        html += `<div class="event-bar-abs${rowCls}" data-evid="${ev.id}" data-evkey="${ev.startKey}" style="left:calc(${leftPct}% + 1px);width:calc(${widthPct}% - 2px);color:${ev.color};"><span>${ev.label}</span></div>`;
      });

      html += `</div>`;
    });

    block.innerHTML = html;

    // attach click handlers after innerHTML (avoids inline onclick in module context)
    block.querySelectorAll('.d:not(.empty)').forEach(cell => {
      cell.addEventListener('click', e => { e.stopPropagation(); onDayClick(e, cell.dataset.key); });
    });
    block.querySelectorAll('.event-bar-abs').forEach(bar => {
      bar.addEventListener('click', e => { e.stopPropagation(); onEventBarClick(e, bar.dataset.evid, bar.dataset.evkey); });
    });

    grid.appendChild(block);
  }
}

export function renderSummary(stays) {
  const allDays = {}, allUnbooked = {};
  stays.forEach(s => {
    const c = s.country;
    let d = ymdToDate(s.start);
    const end = ymdToDate(s.end);
    while (d < end) {
      const y = String(d.getFullYear());
      if (!allDays[y]) allDays[y] = {};
      if (!allUnbooked[y]) allUnbooked[y] = {};
      allDays[y][c] = (allDays[y][c]||0) + 1;
      if (!s.booked) allUnbooked[y][c] = true;
      d.setDate(d.getDate()+1);
    }
  });

  const years = Object.keys(allDays).sort();
  const todayYear = String(TODAY.getFullYear());
  if (!summaryYear || !years.includes(summaryYear))
    summaryYear = years.includes(todayYear) ? todayYear : years[0];

  document.getElementById('summaryYearLabel').textContent = summaryYear;
  const days = allDays[summaryYear] || {};
  const unbooked = allUnbooked[summaryYear] || {};
  const order = Object.keys(days).sort((a,b) => days[b]-days[a]);
  document.getElementById('countryGrid').innerHTML = order.map(c => `
    <div class="country-item">
      <div class="country-name">${COUNTRY_FLAGS[c]||''} ${c}</div>
      <div class="country-days">${days[c]}</div>
      <div class="country-sub">days</div>
      ${unbooked[c]?'<div class="country-pin"><span style="display:inline-block;width:5px;height:5px;background:#d94040;border-radius:50%;"></span> some unbooked</div>':''}
    </div>`).join('');

  return { allDays, years };
}

export function shiftSummaryYear(dir, stays) {
  const { years } = renderSummary(stays);
  const idx = years.indexOf(summaryYear);
  const next = years[idx + dir];
  if (next) { summaryYear = next; renderSummary(stays); }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/calendar.js
git commit -m "feat: add calendar module (render, summary, nav)"
```

---

## Task 8: Editor module

**Files:**
- Create: `src/editor.js`

Port the popup and drawer logic. The editor module fires callbacks (`onSave`, `onDelete`) instead of mutating a global; `main.js` wires the callbacks to db calls.

- [ ] **Step 1: Create `src/editor.js`**

```js
import { TODAY, MONTHS, COUNTRY_CSS, fmtYMD, parseYMD, uid } from './utils.js';

let popupMode = 'stay';
let popupEditStayId  = null;
let popupEditEventId = null;
let selectedColor = '#9b6b8a';
let _onSave = null;
let _onDelete = null;

export function initEditor(onSave, onDelete) {
  _onSave   = onSave;
  _onDelete = onDelete;

  document.getElementById('popupOverlay').addEventListener('click', closePopup);
  document.getElementById('btnPopupClose').addEventListener('click', closePopup);
  document.getElementById('btnSave').addEventListener('click', saveEntry);
  document.getElementById('btnDelete').addEventListener('click', deleteEntry);
  document.getElementById('tabStay').addEventListener('click',  () => switchPopupTab('stay'));
  document.getElementById('tabEvent').addEventListener('click', () => switchPopupTab('event'));

  ['Info','Flight','Accom','Notes'].forEach(t => {
    document.getElementById('stayTab' + t).addEventListener('click', () => switchStayTab(t.toLowerCase()));
  });

  document.querySelectorAll('.swatch').forEach(sw => {
    sw.addEventListener('click', () => pickColor(sw));
  });
  document.getElementById('customColor').addEventListener('input', e => pickCustomColor(e.target.value));
  document.getElementById('pAccomRef').addEventListener('input',    e => updateAccomLink(e.target.value));
  document.getElementById('pEventNote').addEventListener('input',   e => updateEventNoteLink(e.target.value));

  document.getElementById('btnDrawerClose').addEventListener('click', closeEditDrawer);
  document.getElementById('editOverlay').addEventListener('click', closeEditDrawer);
  document.getElementById('btnDrawerSave').addEventListener('click', saveDrawerAndClose);
}

export function handleDayClick(evt, key, dayMap, eventMap) {
  const stay   = dayMap[key];
  const evList = eventMap[key] || [];
  const ev     = evList[0] || null;
  popupEditStayId  = stay ? stay.id : null;
  popupEditEventId = ev   ? ev.id   : null;
  if (stay)    openPopupEditStay(evt, stay, key);
  else if (ev) openPopupEditEvent(evt, ev, key);
  else         openPopupNew(evt, key);
}

export function handleEventBarClick(evt, evId, startKey, events) {
  popupEditStayId  = null;
  popupEditEventId = evId;
  const ev = events.find(e => e.id === evId);
  openPopupEditEvent(evt, ev, startKey);
}

export function openPopupNew(evt, key) {
  popupEditStayId = null; popupEditEventId = null;
  switchPopupTab('stay');
  clearStayFields();
  document.getElementById('pStart').value = key ? fmtYMD(key) : '';
  document.getElementById('pEnd').value   = key ? fmtYMD(key) : '';
  document.getElementById('pEventLabel').value = '';
  document.getElementById('pEventStart').value = key ? fmtYMD(key) : '';
  document.getElementById('pEventEnd').value   = key ? fmtYMD(key) : '';
  document.getElementById('pEventNote').value  = '';
  document.getElementById('pEventNoteLink').style.display = 'none';
  document.getElementById('btnDelete').style.display = 'none';
  const year = key ? +key.slice(0,4) : TODAY.getFullYear();
  const m    = key ? +key.slice(4,6)-1 : TODAY.getMonth();
  const d    = key ? +key.slice(6,8)   : TODAY.getDate();
  document.getElementById('popupDateLabel').textContent = MONTHS[m].slice(0,3) + ' ' + d + ', ' + year;
  positionAndShowPopup(evt);
}

function openPopupEditStay(evt, s, key) {
  switchPopupTab('stay');
  document.getElementById('btnDelete').style.display = '';
  const year = +key.slice(0,4), m = +key.slice(4,6)-1, d = +key.slice(6,8);
  document.getElementById('popupDateLabel').textContent = MONTHS[m].slice(0,3) + ' ' + d + ', ' + year;
  document.getElementById('pCountry').value      = s.country + '|' + s.flag;
  document.getElementById('pLabel').value        = s.label;
  document.getElementById('pStart').value        = fmtYMD(s.start);
  document.getElementById('pEnd').value          = fmtYMD(s.end);
  document.getElementById('pNote').value         = s.note || '';
  document.getElementById('pBooked').checked     = s.booked;
  // Legacy flat fields
  document.getElementById('pFlightIn').value     = s.flightIn     || (s.flight_in?.number  || '');
  document.getElementById('pFlightInRef').value  = s.flightInRef  || (s.flight_in?.booking_ref  || '');
  document.getElementById('pFlightOut').value    = s.flightOut    || (s.flight_out?.number || '');
  document.getElementById('pFlightOutRef').value = s.flightOutRef || (s.flight_out?.booking_ref || '');
  document.getElementById('pAccomName').value    = s.accomName    || (s.accom?.name    || '');
  document.getElementById('pAccomAddr').value    = s.accomAddr    || (s.accom?.address || '');
  document.getElementById('pAccomRef').value     = s.accomRef     || (s.accom?.booking_ref || '');
  updateAccomLink(s.accomRef || s.accom?.booking_ref || '');
  document.getElementById('pTripNotes').value = s.tripNotes || '';
  switchStayTab('info');
  positionAndShowPopup(evt);
}

function openPopupEditEvent(evt, e, key) {
  switchPopupTab('event');
  document.getElementById('btnDelete').style.display = '';
  const year = +key.slice(0,4), m = +key.slice(4,6)-1, d = +key.slice(6,8);
  document.getElementById('popupDateLabel').textContent = MONTHS[m].slice(0,3) + ' ' + d + ', ' + year;
  document.getElementById('pEventLabel').value = e.label;
  document.getElementById('pEventStart').value = fmtYMD(e.start);
  document.getElementById('pEventEnd').value   = fmtYMD(e.end);
  document.getElementById('pEventNote').value  = e.note || '';
  selectedColor = e.color;
  document.querySelectorAll('.swatch').forEach(sw => sw.classList.toggle('picked', sw.dataset.color === e.color));
  document.getElementById('customColor').value = e.color;
  updateEventNoteLink(e.note || '');
  positionAndShowPopup(evt);
}

function clearStayFields() {
  ['pLabel','pStart','pEnd','pNote','pFlightIn','pFlightInRef','pFlightOut','pFlightOutRef','pAccomName','pAccomAddr','pAccomRef','pTripNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('pBooked').checked = false;
  document.getElementById('pCountry').value  = 'Spain|🇪🇸';
  document.getElementById('pAccomLink').style.display = 'none';
  switchStayTab('info');
}

function positionAndShowPopup(evt) {
  const popup = document.getElementById('popup');
  popup.style.left = '-9999px'; popup.style.top = '-9999px'; popup.style.transform = '';
  document.getElementById('popupOverlay').classList.add('open');
  popup.style.display = 'block';
  if (evt) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const pw = 240, ph = 400;
    let x = evt.clientX + 8, y = evt.clientY + 8;
    if (x + pw > vw - 8) x = evt.clientX - pw - 8;
    if (y + ph > vh - 8) y = evt.clientY - ph - 8;
    if (x < 8) x = 8; if (y < 8) y = 8;
    popup.style.left = x + 'px'; popup.style.top = y + 'px';
  } else {
    popup.style.left = '50%'; popup.style.top = '50%';
    popup.style.transform = 'translate(-50%,-50%)';
  }
}

export function closePopup() {
  document.getElementById('popupOverlay').classList.remove('open');
  const popup = document.getElementById('popup');
  popup.style.display = 'none';
  popup.style.transform = '';
}

function switchPopupTab(type) {
  popupMode = type;
  document.getElementById('tabStay').classList.toggle('active',  type==='stay');
  document.getElementById('tabEvent').classList.toggle('active', type==='event');
  document.getElementById('stayFields').style.display  = type==='stay'  ? '' : 'none';
  document.getElementById('eventFields').style.display = type==='event' ? '' : 'none';
  document.getElementById('btnDelete').style.display =
    (type==='stay' ? popupEditStayId : popupEditEventId) ? '' : 'none';
}

function switchStayTab(tab) {
  ['info','flight','accom','notes'].forEach(t => {
    const capT = t.charAt(0).toUpperCase() + t.slice(1);
    document.getElementById('stayTab'   + capT).classList.toggle('active', t===tab);
    document.getElementById('stayPanel' + capT).style.display = t===tab ? '' : 'none';
  });
}

function updateAccomLink(val) {
  const show = val && (val.startsWith('http://') || val.startsWith('https://'));
  document.getElementById('pAccomLink').style.display = show ? '' : 'none';
  if (show) document.getElementById('pAccomLinkA').href = val;
}

function pickColor(el) {
  selectedColor = el.dataset.color;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('picked'));
  el.classList.add('picked');
  document.getElementById('customColor').value = selectedColor;
}
function pickCustomColor(val) {
  selectedColor = val;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('picked'));
}
function updateEventNoteLink(val) {
  const link = document.getElementById('pEventNoteLink');
  const a    = document.getElementById('pEventNoteLinkA');
  if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
    a.href = val; link.style.display = '';
  } else { link.style.display = 'none'; }
}

function saveEntry() {
  if (popupMode === 'stay') {
    const [country, flag] = document.getElementById('pCountry').value.split('|');
    const label    = document.getElementById('pLabel').value.trim() || country;
    const start    = parseYMD(document.getElementById('pStart').value);
    const end      = parseYMD(document.getElementById('pEnd').value);
    const note     = document.getElementById('pNote').value.trim();
    const booked   = document.getElementById('pBooked').checked;
    const cssClass = COUNTRY_CSS[country] || 'c-villa';
    const flightIn     = document.getElementById('pFlightIn').value.trim();
    const flightInRef  = document.getElementById('pFlightInRef').value.trim();
    const flightOut    = document.getElementById('pFlightOut').value.trim();
    const flightOutRef = document.getElementById('pFlightOutRef').value.trim();
    const accomName    = document.getElementById('pAccomName').value.trim();
    const accomAddr    = document.getElementById('pAccomAddr').value.trim();
    const accomRef     = document.getElementById('pAccomRef').value.trim();
    const tripNotes    = document.getElementById('pTripNotes').value.trim();
    if (start.length !== 8 || end.length !== 8) return;
    const trip = {
      id: popupEditStayId || undefined,
      type: 'stay', country, flag, label, cssClass, start, end, booked, note,
      source: 'manual',
      flight_in:  flightIn  ? { number: flightIn,  booking_ref: flightInRef,  confirmed: null, source: 'manual' } : null,
      flight_out: flightOut ? { number: flightOut, booking_ref: flightOutRef, confirmed: null, source: 'manual' } : null,
      accom: accomName ? { name: accomName, address: accomAddr, booking_ref: accomRef, booked: null, source: 'manual' } : null,
      tripNotes,
    };
    _onSave('stay', trip);
  } else {
    const label = document.getElementById('pEventLabel').value.trim();
    const start = parseYMD(document.getElementById('pEventStart').value);
    const end   = parseYMD(document.getElementById('pEventEnd').value);
    const note  = document.getElementById('pEventNote').value.trim();
    if (!label || start.length !== 8 || end.length !== 8) return;
    const event = { id: popupEditEventId || undefined, type: 'event', label, start, end, color: selectedColor, note, source: 'manual' };
    _onSave('event', event);
  }
}

function deleteEntry() {
  if (popupMode === 'stay' && popupEditStayId)
    _onDelete('stay', popupEditStayId);
  else if (popupMode === 'event' && popupEditEventId)
    _onDelete('event', popupEditEventId);
}

export function openEditDrawer(stays, events) {
  renderDrawer(stays, events);
  document.getElementById('editOverlay').style.display = 'block';
  document.getElementById('editDrawer').style.display = 'block';
}

function closeEditDrawer() {
  document.getElementById('editOverlay').style.display = 'none';
  document.getElementById('editDrawer').style.display = 'none';
}

function renderDrawer(stays, events) {
  document.getElementById('tripBody').innerHTML = stays.map(s => {
    const past = new Date(+s.end.slice(0,4), +s.end.slice(4,6)-1, +s.end.slice(6,8)) <= TODAY;
    const dot = `<span class="color-dot" style="background:#ccc"></span>`;
    const startFmt = fmtYMD(s.start), endFmt = fmtYMD(s.end);
    const labelEl = past
      ? `<span style="display:flex;align-items:center;">${dot}${s.flag} ${s.label}</span>`
      : `<span style="display:flex;align-items:center;gap:3px;">${dot}${s.flag} <input type="text" class="wide" value="${s.label.replace(/"/g,'&quot;')}"></span>`;
    const dateStart = past ? `<span class="readonly">${startFmt}</span>` : `<input type="text" value="${startFmt}">`;
    const dateEnd   = past ? `<span class="readonly">${endFmt}</span>`   : `<input type="text" value="${endFmt}">`;
    const statusEl = past
      ? `<span class="status-badge status-done">✓ done</span>`
      : s.booked
        ? `<button class="status-badge status-booked" data-toggleid="${s.id}">✓ booked</button>`
        : `<button class="status-badge status-tobook" data-toggleid="${s.id}"><span style="display:inline-block;width:6px;height:6px;background:#d94040;border-radius:50%;margin-right:4px;vertical-align:middle;"></span>to book</button>`;
    const delBtn = past ? '' : `<button class="status-badge" style="background:#f0ddd0;color:#6b2000;cursor:pointer;margin-left:3px;" data-deleteid="${s.id}">✕</button>`;
    return `<tr class="${past?'is-past':''}" data-id="${s.id}">
      <td>${labelEl}</td><td>${dateStart}</td><td>${dateEnd}</td>
      <td style="white-space:nowrap;">${statusEl}${delBtn}</td></tr>`;
  }).join('');

  document.getElementById('eventBody').innerHTML = events.map(e => {
    const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${e.color};margin-right:5px;flex-shrink:0;"></span>`;
    const noteVal  = (e.note||'').replace(/"/g,'&quot;');
    const labelVal = e.label.replace(/"/g,'&quot;');
    return `<tr data-eid="${e.id}">
      <td><span style="display:flex;align-items:center;">${dot}<input type="text" class="wide" value="${labelVal}"></span></td>
      <td><input type="text" value="${fmtYMD(e.start)}"></td>
      <td><input type="text" value="${fmtYMD(e.end)}"></td>
      <td style="white-space:nowrap;"><input type="text" class="wide" value="${noteVal}" placeholder="url or note">
        <button class="status-badge" style="background:#f0ddd0;color:#6b2000;cursor:pointer;" data-deleteeid="${e.id}">✕</button></td>
    </tr>`;
  }).join('');

  document.querySelectorAll('[data-toggleid]').forEach(btn => {
    btn.addEventListener('click', () => _onDelete('stay-toggle', btn.dataset.toggleid));
  });
  document.querySelectorAll('[data-deleteid]').forEach(btn => {
    btn.addEventListener('click', () => _onDelete('stay', btn.dataset.deleteid));
  });
  document.querySelectorAll('[data-deleteeid]').forEach(btn => {
    btn.addEventListener('click', () => _onDelete('event', btn.dataset.deleteeid));
  });
}

function saveDrawerAndClose() {
  const updates = [];
  document.querySelectorAll('#tripBody tr[data-id]').forEach(row => {
    const inputs = row.querySelectorAll('input[type=text]');
    if (inputs.length === 3) {
      const label = inputs[0].value.trim();
      const sv = parseYMD(inputs[1].value.trim());
      const ev = parseYMD(inputs[2].value.trim());
      if (label && /^\d{8}$/.test(sv) && /^\d{8}$/.test(ev))
        updates.push({ type: 'stay', id: row.dataset.id, label, start: sv, end: ev });
    }
  });
  document.querySelectorAll('#eventBody tr[data-eid]').forEach(row => {
    const inputs = row.querySelectorAll('input[type=text]');
    if (inputs.length >= 3) {
      const label = inputs[0].value.trim();
      const sv = parseYMD(inputs[1].value.trim());
      const ev = parseYMD(inputs[2].value.trim());
      const note = inputs[3] ? inputs[3].value.trim() : '';
      if (label && /^\d{8}$/.test(sv) && /^\d{8}$/.test(ev))
        updates.push({ type: 'event', id: row.dataset.eid, label, start: sv, end: ev, note });
    }
  });
  _onSave('drawer', updates);
  closeEditDrawer();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/editor.js
git commit -m "feat: add editor module (popup + drawer, fires callbacks)"
```

---

## Task 9: Main module (wires everything together)

**Files:**
- Create: `src/main.js`

`main.js` owns the app state (`stays`, `events`, view state), calls `db.js` for persistence, and passes data down to the render modules. It is the only file that knows about all other modules.

- [ ] **Step 1: Create `src/main.js`**

```js
import { getSession, signInWithGoogle, signOut, onAuthChange } from './auth.js';
import { getTrips, saveTrip, deleteTrip, getEvents, saveEvent, deleteEvent } from './db.js';
import { buildDayMap, TODAY } from './utils.js';
import { renderNav, renderCalendar, renderSummary, shiftSummaryYear } from './calendar.js';
import { renderStatus } from './status.js';
import { initEditor, handleDayClick, handleEventBarClick, openPopupNew, closePopup, openEditDrawer } from './editor.js';

// ── view state ────────────────────────────────────────────────────────────────
let viewYear   = TODAY.getFullYear();
let viewMonth  = TODAY.getMonth();
let viewMonths = 6;

// ── data state ────────────────────────────────────────────────────────────────
let stays  = [];
let events = [];

// ── render ───────────────────────────────────────────────────────────────────
function render() {
  const { dayMap, eventMap } = buildDayMap(stays, events);
  renderNav(viewYear, viewMonth, viewMonths);
  renderCalendar(stays, events, viewYear, viewMonth, viewMonths,
    (evt, key)        => handleDayClick(evt, key, dayMap, eventMap),
    (evt, evId, key)  => handleEventBarClick(evt, evId, key, events));
  renderSummary(stays);
  renderStatus(stays, events);
}

async function loadAndRender() {
  [stays, events] = await Promise.all([getTrips(), getEvents()]);
  render();
}

// ── save / delete callbacks (passed to editor) ────────────────────────────────
async function onSave(type, payload) {
  if (type === 'stay') {
    await saveTrip(payload);
    closePopup();
  } else if (type === 'event') {
    await saveEvent(payload);
    closePopup();
  } else if (type === 'drawer') {
    // payload is array of { type, id, label, start, end, note? }
    await Promise.all(payload.map(u => {
      if (u.type === 'stay') {
        const existing = stays.find(s => s.id === u.id);
        return saveTrip({ ...existing, ...u });
      } else {
        const existing = events.find(e => e.id === u.id);
        return saveEvent({ ...existing, ...u });
      }
    }));
  }
  await loadAndRender();
}

async function onDelete(type, id) {
  if (type === 'stay') {
    await deleteTrip(id);
  } else if (type === 'event') {
    await deleteEvent(id);
  } else if (type === 'stay-toggle') {
    const s = stays.find(x => x.id === id);
    if (s) await saveTrip({ ...s, booked: !s.booked });
  }
  await loadAndRender();
}

// ── nav ───────────────────────────────────────────────────────────────────────
function shiftView(dir) {
  if (viewMonths === 12) {
    viewYear += dir;
  } else {
    viewMonth += dir * viewMonths;
    while (viewMonth < 0)  { viewMonth += 12; viewYear--; }
    while (viewMonth > 11) { viewMonth -= 12; viewYear++; }
  }
  render();
}

function snapToToday() {
  viewYear  = TODAY.getFullYear();
  viewMonth = viewMonths === 12 ? 0 : TODAY.getMonth();
  render();
}

function setViewMonths(n) {
  viewMonths = n;
  document.querySelectorAll('.mcbtn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.n) === n));
  viewYear  = TODAY.getFullYear();
  viewMonth = n === 12 ? 0 : TODAY.getMonth();
  render();
}

// ── export / import ───────────────────────────────────────────────────────────
function exportData() {
  const json = JSON.stringify({ stays, events }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'travel-planner-backup.json'; a.click();
  URL.revokeObjectURL(url);
}

async function importData(evt) {
  const file = evt.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const d = JSON.parse(e.target.result);
      if (!d.stays || !d.events) { alert('Invalid backup file.'); return; }
      if (!confirm('This will add all trips from the file to your account. Continue?')) return;
      await Promise.all([
        ...d.stays.map(s  => saveTrip({ ...s,  id: undefined })),
        ...d.events.map(ev => saveEvent({ ...ev, id: undefined })),
      ]);
      await loadAndRender();
    } catch { alert('Could not read file.'); }
  };
  reader.readAsText(file);
  evt.target.value = '';
}

// ── auth ──────────────────────────────────────────────────────────────────────
function showApp()      { document.getElementById('app').style.display = '';     document.getElementById('authGate').style.display = 'none'; }
function showAuthGate() { document.getElementById('app').style.display = 'none'; document.getElementById('authGate').style.display = '';    }

// ── boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  // Wire nav buttons
  document.getElementById('btnPrev').addEventListener('click', () => shiftView(-1));
  document.getElementById('btnNext').addEventListener('click', () => shiftView(1));
  document.getElementById('btnToday').addEventListener('click', snapToToday);
  document.querySelectorAll('.mcbtn').forEach(b => {
    b.addEventListener('click', () => setViewMonths(parseInt(b.dataset.n)));
  });
  document.getElementById('btnExport').addEventListener('click', exportData);
  document.getElementById('btnImportTrigger').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importData);
  document.getElementById('btnSignOut').addEventListener('click', async () => { await signOut(); showAuthGate(); });
  document.getElementById('btnEditDrawer').addEventListener('click', () => openEditDrawer(stays, events));
  document.getElementById('btnAdd').addEventListener('click', () => openPopupNew(null, null));
  document.getElementById('btnSummaryPrev').addEventListener('click', () => { shiftSummaryYear(-1, stays); });
  document.getElementById('btnSummaryNext').addEventListener('click', () => { shiftSummaryYear(1,  stays); });
  document.getElementById('btnSignIn').addEventListener('click', signInWithGoogle);

  // Editor callbacks
  initEditor(onSave, onDelete);

  // Auth check
  const session = await getSession();
  if (session) {
    showApp();
    await loadAndRender();
  } else {
    showAuthGate();
  }

  // Respond to login/logout from other tabs or OAuth redirect
  onAuthChange(async session => {
    if (session) {
      showApp();
      await loadAndRender();
    } else {
      showAuthGate();
    }
  });
}

boot();
```

- [ ] **Step 2: Commit**

```bash
git add src/main.js
git commit -m "feat: add main module (boot, state, wires all modules)"
```

---

## Task 10: Smoke test the app locally

No automated tests exist for this app yet. This task is a manual verification pass before deploying.

- [ ] **Step 1: Fill in real Supabase credentials**

Edit `config.js` and replace the placeholder values with your actual Supabase project URL and anon key from the Supabase dashboard (Settings → API).

- [ ] **Step 2: Serve the app over HTTP (required for ES modules)**

```bash
cd ~/travel-tracker
python3 -m http.server 8080
```

Open `http://localhost:8080` in Chrome/Safari.

- [ ] **Step 3: Auth gate check**

Expected: you see the "Sign in with Google" screen. The `#app` div is hidden.

- [ ] **Step 4: Sign in**

Click "Sign in with Google". Google OAuth flow opens. After approving, you should be redirected back to `http://localhost:8080` and see the calendar (empty — no trips yet).

- [ ] **Step 5: Add a trip**

Click "＋ Add". Fill in: country Spain, label "Test Villa", start `2026/06/01`, end `2026/06/07`. Save. Trip should appear on the calendar as a blue block for June 1–7.

- [ ] **Step 6: Verify in Supabase**

Open Supabase dashboard → Table Editor → trips. You should see one row with your `user_id` and `label = "Test Villa"`.

- [ ] **Step 7: Add an event**

Click a day in June. Switch to Event tab. Label "🎵 Test", start `2026/06/03`, end `2026/06/05`. Save. Ghost outline pill bar should appear spanning 3 days.

- [ ] **Step 8: Edit the trip**

Click the blue block for June 1. Change the label to "Villa Test". Save. Label should update on calendar.

- [ ] **Step 9: Delete the event**

Click the event bar. Click Delete. Event bar should disappear.

- [ ] **Step 10: Sign out and back in**

Click "Sign out". Auth gate reappears. Sign back in. Trip should still be there (loaded from Supabase, not localStorage).

- [ ] **Step 11: Commit if all checks pass**

```bash
git add config.js
git commit -m "feat: wire real Supabase credentials"
```

---

## Task 11: Data migration — import existing trips

Run this after Task 10 is verified working.

- [ ] **Step 1: Export from the old app**

Open the old `index.html` directly in a browser (you may still have it locally or via the GitHub Pages URL). Click "⬇ Export". Save the JSON file as `travel-planner-backup.json`.

- [ ] **Step 2: Create `migrate/migrate.js`**

```js
// Run once: node migrate/migrate.js travel-planner-backup.json
// Requires: npm install @supabase/supabase-js node-fetch
// Set SUPABASE_URL and SUPABASE_ANON as environment variables, OR hardcode temporarily.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON || 'YOUR_ANON_KEY';
const USER_EMAIL    = process.env.MIGRATE_EMAIL || '';
const USER_PASSWORD = process.env.MIGRATE_PASS  || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function toIso(ymd) { return ymd.slice(0,4) + '-' + ymd.slice(4,6) + '-' + ymd.slice(6,8); }

async function run() {
  const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
    email: USER_EMAIL, password: USER_PASSWORD,
  });
  if (authError) {
    // Google OAuth users don't have a password — create a temporary one via Supabase dashboard
    // (Authentication → Users → your user → "Send magic link" or set password)
    console.error('Auth failed:', authError.message);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const userId = session.user.id;

  console.log(`Migrating ${raw.stays.length} trips and ${raw.events.length} events for user ${userId}`);

  for (const s of raw.stays) {
    const { error } = await supabase.from('trips').insert({
      user_id:    userId,
      label:      s.label,
      country:    s.country,
      flag:       s.flag,
      css_class:  s.cssClass,
      start_date: toIso(s.start),
      end_date:   toIso(s.end),
      note:       s.note || '',
      source:     'manual',
    });
    if (error) console.error('Trip error:', s.label, error.message);
    else console.log('  ✓ trip', s.label);
  }

  for (const e of raw.events) {
    const { error } = await supabase.from('events').insert({
      user_id:    userId,
      label:      e.label,
      start_date: toIso(e.start),
      end_date:   toIso(e.end),
      color:      e.color,
      note:       e.note || '',
      source:     'manual',
    });
    if (error) console.error('Event error:', e.label, error.message);
    else console.log('  ✓ event', e.label);
  }

  console.log('Done.');
}

run();
```

- [ ] **Step 3: Run the migration**

```bash
cd ~/travel-tracker
npm install @supabase/supabase-js  # one-time
SUPABASE_URL=https://YOUR.supabase.co SUPABASE_ANON=YOUR_KEY MIGRATE_EMAIL=you@email.com MIGRATE_PASS=yourpass node migrate/migrate.js travel-planner-backup.json
```

Expected output: 30 `✓ trip` lines and 8 `✓ event` lines.

- [ ] **Step 4: Verify in the app**

Reload `http://localhost:8080`. All 30 trips and 8 events should appear on the calendar.

- [ ] **Step 5: Commit**

```bash
git add migrate/migrate.js
git commit -m "feat: add data migration script for localStorage export"
```

---

## Task 12: GitHub Actions deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Enable Pages in GitHub repository settings**

Go to github.com → your `travel-tracker` repo → Settings → Pages → Source: "GitHub Actions".

- [ ] **Step 3: Push and verify**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy to Pages"
git push origin main
```

Open github.com → your repo → Actions tab. The "Deploy to GitHub Pages" workflow should run and succeed. The app should be live at `https://lagar23.github.io/travel-tracker`.

- [ ] **Step 4: Add the Pages URL to Supabase redirect allowlist**

Supabase → Authentication → URL Configuration → add `https://lagar23.github.io/travel-tracker` to Redirect URLs. Also update Site URL to the same.

- [ ] **Step 5: Sign in on the live URL**

Open `https://lagar23.github.io/travel-tracker`. Sign in with Google. Your trips should load.

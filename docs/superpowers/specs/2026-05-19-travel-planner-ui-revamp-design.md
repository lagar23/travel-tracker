# Travel Planner UI Revamp — Design Spec

**Date:** 2026-05-19  
**Status:** Approved  
**Scope:** Visual redesign of `~/travel-tracker/index.html` — layout, typography, colour, multi-event rendering

---

## Overview

The current travel planner is a single-file HTML app (CSS + JS inline, localStorage persistence) shared at `lagar23.github.io/travel-tracker`. This redesign replaces the existing calendar UI with a cleaner, more polished layout inspired by a "beige pages notebook" aesthetic. It also fixes the broken multi-event-per-day rendering, which currently collapses to one visible bar when multiple events share a day.

No backend changes. No data model changes. The redesign is purely presentational.

---

## Design Decisions

### Aesthetic

- **Palette:** Warm earthy tones
  - Page background: `#e8e0cc`
  - Calendar surface: `#f5f0e6`
  - Header background: `#f0ead8`
  - Dark text: `#2e2010`
  - Muted text: `#8a7050`
  - Border/divider: `#d4c8a8`
- **Typography:**
  - App title and month names: Georgia serif
  - All UI chrome (buttons, labels, status text): `-apple-system` sans-serif
  - No ruled lines (considered and rejected — serif font + warm palette carries the notebook feel without literal lines)

### Header (single row, 52px)

Layout: `title | nav group | action buttons` — all in one sticky bar.

- **Left:** `2026 Travel` in Georgia 18px bold
- **Center:** `‹` arrow · month range label · `›` arrow · `Today` button · divider · `3 / 6 / 9 / 12` month-count toggles
- **Right:** `✏️ Edit` button (secondary style) · `＋ Add` button (dark primary)
- Full text on buttons, not icon-only

### Status Bar (30px, below header)

Single slim bar, vertically centered (`height: 30px; display: flex; align-items: center`):

> Today: 🇪🇸 Mallorca · 3 still to book · Next unbooked: 🇵🇹 Portugal (May 31)

Shows current location (flag + destination), count of unbooked stays, and next unbooked destination with date.

### Calendar Surface

All months share **one unified surface** — a single `#f5f0e6` rounded card. No per-month cards, no per-month borders or padding.

- **Grid:** 4 columns × N rows (3 rows for 12-month view). Month name floats above each grid as a header.
- **Row separation:** hairline `border-top: 1px solid #d4c8a8` between row 1 and row 2 of months, not per-month outlines.
- **Day cell:** `min-height: 52px`, day number top-right, event bars stacked from bottom.

### Multi-Event Rendering (the main fix)

Each day cell is `position: relative`. Event bars are `position: absolute`, bottom-anchored:

- **Row 1 (bottom):** `bottom: 2px` — the lowest event or single-event
- **Row 2:** `bottom: 17px` — second event stacks above row 1

Multi-day events span columns using `calc(col / 7 * 100%)` for left/width. Same-day events (flights, single-day activities) each get their own row.

Event bar specs:
- Height: `13px`, border-radius `3px`
- Font: `8.5px`, weight `700`, white text, `overflow: hidden`, `white-space: nowrap`, `text-overflow: ellipsis`
- Colour coding preserved from current app (stays vs events vs flights)

### Month Count Toggles (3 / 6 / 9 / 12)

Toggle buttons in the header control how many months render. Active state: dark background (`#3d2b1f`, white text). Inactive: muted background.

### Export / Import (already implemented)

`⬇ Export` and `⬆ Import` buttons are in the top-right actions area (already live). These survive the redesign unchanged.

---

## Components to Rewrite

| Component | Change |
|-----------|--------|
| CSS variables / palette | Replace with warm earthy tokens |
| `.app-header` | Rebuild as single-row flex bar |
| `.status-bar` | New: slim 30px bar below header |
| `.cal-surface` | New: single unified card wrapping all months |
| Month grid layout | 4-column CSS grid, month name above |
| Day cell | `position: relative`, `min-height: 52px` |
| Event bar rendering | Absolute-positioned, bottom-stacked |
| Typography | Georgia for headings, system-sans for chrome |

---

## Out of Scope

- Data model changes
- Backend / multi-user support (Supabase path is a separate future project)
- New event types or form changes
- Mobile / responsive layout (single-user desktop tool for now)

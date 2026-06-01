import { getSession, signInWithGoogle, signOut, onAuthChange, getGmailAccessToken } from './auth.js';
import { getTrips, saveTrip, deleteTrip, getEvents, saveEvent, deleteEvent } from './db.js';
import { buildDayMap, TODAY } from './utils.js';
import { renderNav, renderCalendar, renderSummary, shiftSummaryYear } from './calendar.js';
import { renderStatus, setGmailBarState } from './status.js';
import { initEditor, handleDayClick, handleEventBarClick, openPopupNew, closePopup, openEditDrawer, openGmailPreFill } from './editor.js';
import { scanGmail, airportCountry, LAST_ID_KEY, SUGGESTIONS_KEY, DISMISSED_REFS_KEY } from './gmail.js';
import { openGmailDrawer, closeGmailDrawer, updateGmailDrawerStays } from './gmail-drawer.js';

// ── view state ────────────────────────────────────────────────────────────────
let viewYear   = TODAY.getFullYear();
let viewMonth  = TODAY.getMonth();
let viewMonths = 6;

// ── data state ────────────────────────────────────────────────────────────────
let stays  = [];
let events = [];
let suggestions = null; // { matched: [], unmatched: [], lastMessageId }

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
    if (s) {
      const nowBooked = !s.booked;
      await saveTrip({ ...s, booked_transportation: nowBooked, booked_stay: nowBooked, booked: nowBooked });
    }
  }
  await loadAndRender();
}

function saveSuggestions(s) {
  try { localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(s)); } catch {}
}

function loadPersistedSuggestions() {
  try {
    const raw = localStorage.getItem(SUGGESTIONS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function dismissedRefs() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_REFS_KEY) || '[]')); } catch { return new Set(); }
}

function addDismissedRef(ref) {
  const refs = dismissedRefs();
  if (ref) refs.add(ref);
  try { localStorage.setItem(DISMISSED_REFS_KEY, JSON.stringify([...refs])); } catch {}
}

function filterDismissed(s) {
  const dismissed = dismissedRefs();
  const key = b => b.ref || b.gmailUrl;
  return {
    matched:   s.matched.filter(m => !dismissed.has(key(m.booking))),
    unmatched: s.unmatched.filter(b => !dismissed.has(key(b))),
    lastMessageId: s.lastMessageId,
  };
}

function applyAndShowSuggestions(s) {
  suggestions = filterDismissed(s);
  saveSuggestions(s); // persist pre-filter so re-opens after dismiss still work
  const count = suggestions.matched.length + suggestions.unmatched.length;
  if (count > 0) {
    setGmailBarState('found', { count, onBarClick: openDrawer, onRescan: () => runGmailScan(true) });
  } else {
    setGmailBarState('uptodate', { onRescan: () => runGmailScan(true) });
  }
}

async function runGmailScan(fullRescan = false) {
  if (fullRescan) {
    localStorage.removeItem(LAST_ID_KEY);
    localStorage.removeItem(SUGGESTIONS_KEY);
    localStorage.removeItem(DISMISSED_REFS_KEY);
  }

  // Restore persisted suggestions immediately while we (re)fetch
  if (!fullRescan) {
    const persisted = loadPersistedSuggestions();
    if (persisted) {
      applyAndShowSuggestions(persisted);
      return; // don't re-fetch on plain page load, only on explicit rescan
    }
  }

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
    const fresh = await scanGmail(token, stays);
    applyAndShowSuggestions(fresh);
  } catch (err) {
    if (err.code === 'NO_GMAIL_SCOPE') {
      setGmailBarState('disconnected', {
        onConnect: signInWithGoogle,
        onDismissConnect: () => {},
      });
    } else {
      console.error('Gmail scan error:', err);
      setGmailBarState('uptodate', { onRescan: () => runGmailScan(true) });
    }
  }
}

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
        addDismissedRef(booking.ref || booking.gmailUrl);
        suggestions.matched = suggestions.matched.filter(m => m.booking !== booking);
        saveSuggestions(loadPersistedSuggestions() ?? suggestions);
        updateGmailDrawerStays(stays, suggestions.matched);
        const count = suggestions.matched.length + suggestions.unmatched.length;
        if (count > 0) setGmailBarState('found', { count, onBarClick: openDrawer, onRescan: () => runGmailScan(true) });
        else { setGmailBarState('uptodate', { onRescan: () => runGmailScan(true) }); closeGmailDrawer(); }
      } else if (action === 'edit') {
        closeGmailDrawer();
        openGmailPreFill(booking, stay);
      } else if (action === 'create') {
        closeGmailDrawer();
        openPopupNew(null, booking.dateStart);
      }
    },
    (dismissedBooking) => {
      if (dismissedBooking) addDismissedRef(dismissedBooking.ref || dismissedBooking.gmailUrl);
      saveSuggestions(loadPersistedSuggestions() ?? suggestions);
      const count = suggestions.matched.length + suggestions.unmatched.length;
      if (count === 0) { setGmailBarState('uptodate', { onRescan: () => runGmailScan(true) }); }
    },
  );
}

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
        name: booking.inbound?.destination || '',
        address: '',
        booking_ref: booking.ref,
        booked: null,
        source: 'gmail',
      },
    };
  }
  return stay;
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
  reader.onload = e => {
    (async () => {
      try {
        const d = JSON.parse(e.target.result);
        if (!d.stays || !d.events) { alert('Invalid backup file.'); return; }
        if (!confirm(`Import ${d.stays.length} trips and ${d.events.length} events? They will be added to your account.`)) return;
        const errors = [];
        for (const s of d.stays) {
          try { await saveTrip({ ...s, id: undefined }); }
          catch (err) { errors.push(`Trip "${s.label}": ${err.message}`); }
        }
        for (const ev of d.events) {
          try { await saveEvent({ ...ev, id: undefined }); }
          catch (err) { errors.push(`Event "${ev.label}": ${err.message}`); }
        }
        if (errors.length) alert('Some items failed:\n' + errors.join('\n'));
        await loadAndRender();
      } catch (err) { alert('Could not read file: ' + err.message); }
    })();
  };
  reader.readAsText(file);
  evt.target.value = '';
}

// ── auth ──────────────────────────────────────────────────────────────────────
function showApp()      { document.getElementById('app').style.display = '';     document.getElementById('authGate').style.display = 'none'; }
function showAuthGate() { document.getElementById('app').style.display = 'none'; document.getElementById('authGate').style.display = 'flex'; }

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
  document.getElementById('btnSignOut').addEventListener('click', async () => { try { await signOut(); } catch (e) { console.error('Sign out error:', e); } showAuthGate(); });
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
    runGmailScan();
  } else {
    showAuthGate();
  }

  // Respond to login/logout from other tabs or OAuth redirect
  onAuthChange(async session => {
    if (session) {
      showApp();
      await loadAndRender();
      runGmailScan();
    } else {
      showAuthGate();
    }
  });
}

boot();

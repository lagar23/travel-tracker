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

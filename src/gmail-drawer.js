import { airportCity } from './gmail.js';

let _onAccept = null;
let _onDismiss = null;
let _currentSuggestions = null;
let _currentStays = null;

const TYPE_ICON = { flight: '✈️', accommodation: '🏠', train: '🚂', bus: '🚌' };

const safe = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function fmtDate(ymd) {
  if (!ymd) return '';
  return `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`;
}

function summaryLine(booking) {
  const icon    = TYPE_ICON[booking.type] ?? '📋';
  const carrier = safe(booking.inbound?.carrier || booking.type);
  let route = '';
  if (booking.inbound?.origin && booking.inbound?.destination) {
    const from = safe(airportCity(booking.inbound.origin));
    const to   = safe(airportCity(booking.inbound.destination));
    route = ` · ${from} → ${to}`;
  } else if (booking.type === 'accommodation' && booking.inbound?.destination) {
    route = ` · ${safe(booking.inbound.destination)}`;
  }
  const date = booking.dateStart ? ` · ${fmtDate(booking.dateStart)}` : '';
  const ref  = booking.ref ? ` · ${safe(booking.ref)}` : '';
  return `${icon} ${carrier}${route}${date}${ref}`;
}

function matchLine(booking, stay) {
  if (!stay) return `<span style="color:#c06040;">No match found</span>`;
  return `<span style="color:#2e7040;">→ ${safe(stay.flag)} ${safe(stay.label)}, ${safe(stay.country)} ${stay.start.slice(0,4)}-${stay.start.slice(4,6)}-${stay.start.slice(6,8)} – ${stay.end.slice(4,6)}-${stay.end.slice(6,8)}</span>`;
}

function renderRow(item, index, isMatched) {
  const { booking, stay } = isMatched ? item : { booking: item, stay: null };
  const actionBtns = isMatched
    ? `<button class="gmail-btn gmail-accept" data-idx="${index}">✓ Accept</button>
       <button class="gmail-btn gmail-edit"   data-idx="${index}">✎ Edit</button>
       <button class="gmail-btn gmail-dismiss" data-idx="${index}">✕</button>`
    : `<button class="gmail-btn gmail-create" data-idx="${index}">+ Create stay</button>
       <button class="gmail-btn gmail-dismiss" data-idx="${index}">✕</button>`;

  return `<div class="gmail-row" data-idx="${index}" data-matched="${isMatched}">
    <div class="gmail-row-body">
      <div class="gmail-summary">${summaryLine(booking)}</div>
      <div class="gmail-match">${matchLine(booking, stay)}</div>
      <a href="${safe(booking.gmailUrl)}" target="_blank" rel="noopener noreferrer" class="gmail-email-link">View email →</a>
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
      let dismissedBooking;
      if (isMatched) {
        dismissedBooking = matched[idx]?.booking;
        _currentSuggestions.matched.splice(idx, 1);
      } else {
        dismissedBooking = unmatched[idx - matched.length];
        _currentSuggestions.unmatched.splice(idx - matched.length, 1);
      }
      renderList();
      _onDismiss(dismissedBooking);
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

export function updateGmailDrawerStays(stays, matchedOverride) {
  if (!_currentSuggestions) return;
  _currentStays = stays;
  if (matchedOverride) _currentSuggestions.matched = matchedOverride;
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

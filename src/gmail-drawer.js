import { airportCity } from './gmail.js';

let _onAccept = null;
let _onDismiss = null;
let _currentSuggestions = null;
let _currentStays = null;

// selectedStay[groupKey] = stayId of the currently selected option
const selectedStay = {};

const TYPE_ICON = { flight: '✈️', accommodation: '🏠', train: '🚂', bus: '🚌' };

const safe = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function fmtDate(ymd) {
  if (!ymd) return '';
  return `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`;
}

function stayLabel(stay) {
  return `${safe(stay.flag)} ${safe(stay.label)}, ${safe(stay.country)} · ${stay.start.slice(0,4)}-${stay.start.slice(4,6)}-${stay.start.slice(6,8)} – ${stay.end.slice(4,6)}-${stay.end.slice(6,8)}`;
}

function summaryLine(booking) {
  const icon    = TYPE_ICON[booking.type] ?? '📋';
  const carrier = safe(booking.inbound?.carrier || booking.type);
  const date    = booking.dateStart ? fmtDate(booking.dateStart) : '';
  const ref     = booking.ref ? safe(booking.ref) : '';

  if (booking.type === 'accommodation') {
    const where = safe(booking.inbound?.destination || '');
    return `${icon} ${carrier}${where ? ` · ${where}` : ''}${date ? ` · ${date}` : ''}${ref ? ` · ${ref}` : ''}`;
  }

  let route = '';
  if (booking.inbound?.origin && booking.inbound?.destination) {
    route = `${safe(airportCity(booking.inbound.origin))} → ${safe(airportCity(booking.inbound.destination))}`;
  }
  const parts = [carrier, date, route, ref].filter(Boolean);
  return `${icon} ${parts.join(' · ')}`;
}

// Group matched items by booking identity so one booking = one row
function groupMatched(matched) {
  const groups = [];
  const keyOf = item => (item.booking.ref || item.booking.gmailUrl) + '|' + item.booking.dateStart;
  const seen = new Map();
  for (const item of matched) {
    const k = keyOf(item);
    if (seen.has(k)) {
      seen.get(k).stays.push(item.stay);
    } else {
      const g = { booking: item.booking, stays: [item.stay], key: k };
      seen.set(k, g);
      groups.push(g);
    }
  }
  return groups;
}

function renderGroup(group, gIdx) {
  const { booking, stays, key } = group;
  const multipleStays = stays.length > 1;

  // Default selection
  if (!selectedStay[key]) selectedStay[key] = stays[0].id;

  const stayOptions = multipleStays
    ? `<div class="gmail-stay-options">
        <div style="font-size:9px;color:#9a8070;margin-bottom:4px;">Which trip does this belong to?</div>
        ${stays.map(s => `
          <label class="gmail-stay-option ${selectedStay[key] === s.id ? 'selected' : ''}" data-gidx="${gIdx}" data-stayid="${s.id}">
            <input type="radio" name="stay-${gIdx}" value="${s.id}" ${selectedStay[key] === s.id ? 'checked' : ''} style="margin-right:5px;">
            ${stayLabel(s)}
          </label>`).join('')}
       </div>`
    : `<div class="gmail-match"><span style="color:#2e7040;">→ ${stayLabel(stays[0])}</span></div>`;

  return `<div class="gmail-row" data-gidx="${gIdx}">
    <div class="gmail-row-body">
      <div class="gmail-summary">${summaryLine(booking)}</div>
      ${stayOptions}
      <a href="${safe(booking.gmailUrl)}" target="_blank" rel="noopener noreferrer" class="gmail-email-link">View email →</a>
    </div>
    <div class="gmail-row-actions">
      <button class="gmail-btn gmail-accept" data-gidx="${gIdx}">✓ Accept</button>
      <button class="gmail-btn gmail-edit"   data-gidx="${gIdx}">✎ Edit</button>
      <button class="gmail-btn gmail-dismiss" data-gidx="${gIdx}">✕</button>
    </div>
  </div>`;
}

function renderUnmatched(booking, idx) {
  return `<div class="gmail-row" data-uidx="${idx}">
    <div class="gmail-row-body">
      <div class="gmail-summary">${summaryLine(booking)}</div>
      <div class="gmail-match"><span style="color:#c06040;">No match found</span></div>
      <a href="${safe(booking.gmailUrl)}" target="_blank" rel="noopener noreferrer" class="gmail-email-link">View email →</a>
    </div>
    <div class="gmail-row-actions">
      <button class="gmail-btn gmail-create" data-uidx="${idx}">+ Create stay</button>
      <button class="gmail-btn gmail-dismiss-u" data-uidx="${idx}">✕</button>
    </div>
  </div>`;
}

function renderList() {
  const { matched, unmatched } = _currentSuggestions;
  const groups = groupMatched(matched);
  const list = document.getElementById('gmailSuggestionList');
  const sub  = document.getElementById('gmailDrawerSubtitle');

  const total = groups.length + unmatched.length;
  sub.textContent = `${total} suggestion${total !== 1 ? 's' : ''} — ${groups.length} matched to existing stays, ${unmatched.length} unmatched.`;

  list.innerHTML = [
    ...groups.map((g, i) => renderGroup(g, i)),
    ...unmatched.map((b, i) => renderUnmatched(b, i)),
  ].join('') || '<p style="padding:12px;color:#9a8070;font-size:11px;">All suggestions reviewed.</p>';

  wireButtons(groups);
}

function wireButtons(groups) {
  const list = document.getElementById('gmailSuggestionList');

  // Radio selection
  list.querySelectorAll('.gmail-stay-option').forEach(label => {
    label.addEventListener('click', () => {
      const gIdx   = parseInt(label.dataset.gidx);
      const stayId = label.dataset.stayid;
      const key    = groups[gIdx]?.key;
      if (key) {
        selectedStay[key] = stayId;
        renderList();
      }
    });
  });

  list.querySelectorAll('.gmail-accept').forEach(btn => {
    btn.addEventListener('click', () => {
      const gIdx  = parseInt(btn.dataset.gidx);
      const group = groups[gIdx];
      if (!group) return;
      const stay = group.stays.find(s => s.id === selectedStay[group.key]) ?? group.stays[0];
      _onAccept('accept', group.booking, stay);
    });
  });

  list.querySelectorAll('.gmail-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const gIdx  = parseInt(btn.dataset.gidx);
      const group = groups[gIdx];
      if (!group) return;
      const stay = group.stays.find(s => s.id === selectedStay[group.key]) ?? group.stays[0];
      _onAccept('edit', group.booking, stay);
    });
  });

  list.querySelectorAll('.gmail-dismiss').forEach(btn => {
    btn.addEventListener('click', () => {
      const gIdx  = parseInt(btn.dataset.gidx);
      const group = groups[gIdx];
      if (!group) return;
      // Remove all matched entries for this booking
      const key = group.key;
      const ref = group.booking.ref || group.booking.gmailUrl;
      _currentSuggestions.matched = _currentSuggestions.matched.filter(
        m => (m.booking.ref || m.booking.gmailUrl) + '|' + m.booking.dateStart !== key
      );
      delete selectedStay[key];
      renderList();
      _onDismiss(group.booking);
    });
  });

  list.querySelectorAll('.gmail-create').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx     = parseInt(btn.dataset.uidx);
      const booking = _currentSuggestions.unmatched[idx];
      if (!booking) return;
      _onAccept('create', booking, null);
    });
  });

  list.querySelectorAll('.gmail-dismiss-u').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx     = parseInt(btn.dataset.uidx);
      const booking = _currentSuggestions.unmatched[idx];
      if (!booking) return;
      _currentSuggestions.unmatched.splice(idx, 1);
      renderList();
      _onDismiss(booking);
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

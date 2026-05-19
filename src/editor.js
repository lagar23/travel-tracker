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

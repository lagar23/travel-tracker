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
    bar.innerHTML = `<span class="gmail-dot-pulse" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#c0a030;"></span>Scanning Gmail for bookings…`;
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

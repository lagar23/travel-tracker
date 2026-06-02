import { buildDayMap, dateToYMD, fmtYMD, TODAY, ymdToDate } from './utils.js';

let _lastScanMs = null;
let _gmailState = 'hidden'; // 'hidden' | 'disconnected' | 'scanning' | 'found' | 'uptodate'
let _suggestionCount = 0;
let _onBarClick  = null;
let _onConnect   = null;
let _onRescan    = null;
let _onStop      = null;
let _onDismissConnect = null;

export function setGmailBarState(state, opts = {}) {
  _gmailState      = state;
  _suggestionCount = opts.count ?? _suggestionCount;
  _onBarClick      = opts.onBarClick    ?? _onBarClick;
  _onConnect       = opts.onConnect     ?? _onConnect;
  _onRescan        = opts.onRescan      ?? _onRescan;
  _onStop          = opts.onStop        ?? _onStop;
  _onDismissConnect = opts.onDismissConnect ?? _onDismissConnect;
  if (state === 'uptodate' || state === 'found') _lastScanMs = Date.now();
  renderGmailBar();
}

function timeSince() {
  if (!_lastScanMs) return 'just now';
  const d    = new Date(_lastScanMs);
  const hhmm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const secs = Math.round((Date.now() - _lastScanMs) / 1000);
  if (secs < 3600) return `${hhmm} (${secs < 60 ? 'just now' : Math.round(secs/60) + ' min ago'})`;
  return `${hhmm}`;
}

function renderGmailBar() {
  const bar = document.getElementById('gmailBar');
  if (!bar) return;
  bar.innerHTML = '';
  bar.onclick = null;

  if (_gmailState === 'hidden') { bar.style.display = 'none'; return; }
  bar.style.display = 'inline-flex';

  const rescanBtn = `<span class="gmail-bar-rescan" id="gmailBarRescan">Rescan</span>`;

  if (_gmailState === 'disconnected') {
    bar.innerHTML = `<span style="color:#6a5030;">📬 Connect Gmail</span>
      <button id="gmailConnectBtn" style="font-size:9px;padding:1px 6px;background:#2e2010;color:#f5efe6;border:none;border-radius:4px;cursor:pointer;">Connect</button>
      <span id="gmailDismissConnect" style="color:#b0a090;font-size:9px;cursor:pointer;text-decoration:underline;">Not now</span>`;
    document.getElementById('gmailConnectBtn')?.addEventListener('click', () => _onConnect?.());
    document.getElementById('gmailDismissConnect')?.addEventListener('click', () => { _gmailState = 'hidden'; renderGmailBar(); _onDismissConnect?.(); });
    return;
  }

  if (_gmailState === 'scanning') {
    bar.innerHTML = `<span class="gmail-dot-pulse" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#c0a030;flex-shrink:0;"></span><span>Scanning Gmail…</span><span id="gmailBarStop" style="color:#9a8070;font-size:9px;cursor:pointer;text-decoration:underline;">Stop</span>`;
    document.getElementById('gmailBarStop')?.addEventListener('click', () => _onStop?.());
    return;
  }

  if (_gmailState === 'found') {
    bar.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#c04030;flex-shrink:0;"></span>
      <span style="color:#8b1a0a;font-weight:700;cursor:pointer;" id="gmailFoundLabel">${_suggestionCount} booking suggestion${_suggestionCount !== 1 ? 's' : ''} — click to review</span>
      <span style="color:#9a8070;">· ${timeSince()} · ${rescanBtn}</span>`;
    document.getElementById('gmailFoundLabel')?.addEventListener('click', () => _onBarClick?.());
    document.getElementById('gmailBarRescan')?.addEventListener('click', (e) => { e.stopPropagation(); _onRescan?.(); });
    return;
  }

  if (_gmailState === 'uptodate') {
    bar.innerHTML = `<span style="color:#9a8070;">✓ Gmail scanned · ${timeSince()} · ${rescanBtn}</span>`;
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
    (nextUnbooked ? `<span>Next unbooked: ${nextUnbooked.flag} ${nextUnbooked.label} (${fmtYMD(nextUnbooked.start)})</span>` : '') +
    `<span id="gmailBar" style="margin-left:auto;display:none;align-items:center;gap:6px;font-size:10px;font-family:-apple-system,sans-serif;"></span>`;
  renderGmailBar();
}

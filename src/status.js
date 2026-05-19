import { buildDayMap, dateToYMD, fmtYMD, TODAY, ymdToDate } from './utils.js';

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

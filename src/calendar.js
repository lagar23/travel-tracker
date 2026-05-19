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

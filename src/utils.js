export const TODAY = new Date();
TODAY.setHours(0,0,0,0);

export const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

export const DOT_COLORS = {
  'c-villa':'#b8c9e0','c-gijon':'#8aacc8','c-madrid':'#ccd9ed','c-bilbao':'#9ab4d0',
  'c-santander':'#a8ccd8','c-aranda':'#7898b8','c-avila':'#c0cfe0',
  'c-ireland':'#b8dec0','c-megans':'#9acc9e',
  'c-thailand':'#e8c9a0','c-london':'#c9b8e0','c-italy':'#f0c8d8',
  'c-boston':'#c8d4b8','c-toronto':'#c8c4dc','c-portugal':'#e8d8a0','c-kazakhstan':'#d4b8a0',
};

export const COUNTRY_CSS = {
  'Spain':'c-villa','Ireland':'c-ireland','Thailand':'c-thailand','Portugal':'c-portugal',
  'Italy':'c-italy','Kazakhstan':'c-kazakhstan','UK':'c-london','USA':'c-boston','Canada':'c-toronto',
};

export const COUNTRY_FLAGS = {
  "Afghanistan":"🇦🇫","Albania":"🇦🇱","Algeria":"🇩🇿","Andorra":"🇦🇩","Angola":"🇦🇴",
  "Antigua and Barbuda":"🇦🇬","Argentina":"🇦🇷","Armenia":"🇦🇲","Australia":"🇦🇺","Austria":"🇦🇹",
  "Azerbaijan":"🇦🇿","Bahamas":"🇧🇸","Bahrain":"🇧🇭","Bangladesh":"🇧🇩","Barbados":"🇧🇧",
  "Belarus":"🇧🇾","Belgium":"🇧🇪","Belize":"🇧🇿","Benin":"🇧🇯","Bhutan":"🇧🇹",
  "Bolivia":"🇧🇴","Bosnia and Herzegovina":"🇧🇦","Botswana":"🇧🇼","Brazil":"🇧🇷","Brunei":"🇧🇳",
  "Bulgaria":"🇧🇬","Burkina Faso":"🇧🇫","Burundi":"🇧🇮","Cambodia":"🇰🇭","Cameroon":"🇨🇲",
  "Canada":"🇨🇦","Cape Verde":"🇨🇻","Central African Republic":"🇨🇫","Chad":"🇹🇩","Chile":"🇨🇱",
  "China":"🇨🇳","Colombia":"🇨🇴","Comoros":"🇰🇲","Congo":"🇨🇬","Costa Rica":"🇨🇷",
  "Croatia":"🇭🇷","Cuba":"🇨🇺","Cyprus":"🇨🇾","Czech Republic":"🇨🇿","Denmark":"🇩🇰",
  "Djibouti":"🇩🇯","Dominica":"🇩🇲","Dominican Republic":"🇩🇴","Ecuador":"🇪🇨","Egypt":"🇪🇬",
  "El Salvador":"🇸🇻","Equatorial Guinea":"🇬🇶","Eritrea":"🇪🇷","Estonia":"🇪🇪","Eswatini":"🇸🇿",
  "Ethiopia":"🇪🇹","Fiji":"🇫🇯","Finland":"🇫🇮","France":"🇫🇷","Gabon":"🇬🇦",
  "Gambia":"🇬🇲","Georgia":"🇬🇪","Germany":"🇩🇪","Ghana":"🇬🇭","Greece":"🇬🇷",
  "Grenada":"🇬🇩","Guatemala":"🇬🇹","Guinea":"🇬🇳","Guinea-Bissau":"🇬🇼","Guyana":"🇬🇾",
  "Haiti":"🇭🇹","Honduras":"🇭🇳","Hungary":"🇭🇺","Iceland":"🇮🇸","India":"🇮🇳",
  "Indonesia":"🇮🇩","Iran":"🇮🇷","Iraq":"🇮🇶","Ireland":"🇮🇪","Israel":"🇮🇱",
  "Italy":"🇮🇹","Jamaica":"🇯🇲","Japan":"🇯🇵","Jordan":"🇯🇴","Kazakhstan":"🇰🇿",
  "Kenya":"🇰🇪","Kiribati":"🇰🇮","Kuwait":"🇰🇼","Kyrgyzstan":"🇰🇬","Laos":"🇱🇦",
  "Latvia":"🇱🇻","Lebanon":"🇱🇧","Lesotho":"🇱🇸","Liberia":"🇱🇷","Libya":"🇱🇾",
  "Liechtenstein":"🇱🇮","Lithuania":"🇱🇹","Luxembourg":"🇱🇺","Madagascar":"🇲🇬","Malawi":"🇲🇼",
  "Malaysia":"🇲🇾","Maldives":"🇲🇻","Mali":"🇲🇱","Malta":"🇲🇹","Marshall Islands":"🇲🇭",
  "Mauritania":"🇲🇷","Mauritius":"🇲🇺","Mexico":"🇲🇽","Micronesia":"🇫🇲","Moldova":"🇲🇩",
  "Monaco":"🇲🇨","Mongolia":"🇲🇳","Montenegro":"🇲🇪","Morocco":"🇲🇦","Mozambique":"🇲🇿",
  "Myanmar":"🇲🇲","Namibia":"🇳🇦","Nauru":"🇳🇷","Nepal":"🇳🇵","Netherlands":"🇳🇱",
  "New Zealand":"🇳🇿","Nicaragua":"🇳🇮","Niger":"🇳🇪","Nigeria":"🇳🇬","North Macedonia":"🇲🇰",
  "Norway":"🇳🇴","Oman":"🇴🇲","Pakistan":"🇵🇰","Palau":"🇵🇼","Panama":"🇵🇦",
  "Papua New Guinea":"🇵🇬","Paraguay":"🇵🇾","Peru":"🇵🇪","Philippines":"🇵🇭","Poland":"🇵🇱",
  "Portugal":"🇵🇹","Qatar":"🇶🇦","Romania":"🇷🇴","Russia":"🇷🇺","Rwanda":"🇷🇼",
  "Saint Kitts and Nevis":"🇰🇳","Saint Lucia":"🇱🇨","Saint Vincent and the Grenadines":"🇻🇨",
  "Samoa":"🇼🇸","San Marino":"🇸🇲","Sao Tome and Principe":"🇸🇹","Saudi Arabia":"🇸🇦",
  "Senegal":"🇸🇳","Serbia":"🇷🇸","Seychelles":"🇸🇨","Sierra Leone":"🇸🇱","Singapore":"🇸🇬",
  "Slovakia":"🇸🇰","Slovenia":"🇸🇮","Solomon Islands":"🇸🇧","Somalia":"🇸🇴","South Africa":"🇿🇦",
  "South Korea":"🇰🇷","South Sudan":"🇸🇸","Spain":"🇪🇸","Sri Lanka":"🇱🇰","Sudan":"🇸🇩",
  "Suriname":"🇸🇷","Sweden":"🇸🇪","Switzerland":"🇨🇭","Syria":"🇸🇾","Taiwan":"🇹🇼",
  "Tajikistan":"🇹🇯","Tanzania":"🇹🇿","Thailand":"🇹🇭","Timor-Leste":"🇹🇱","Togo":"🇹🇬",
  "Tonga":"🇹🇴","Trinidad and Tobago":"🇹🇹","Tunisia":"🇹🇳","Turkey":"🇹🇷","Turkmenistan":"🇹🇲",
  "Tuvalu":"🇹🇻","Uganda":"🇺🇬","Ukraine":"🇺🇦","United Arab Emirates":"🇦🇪","UK":"🇬🇧",
  "USA":"🇺🇸","Uruguay":"🇺🇾","Uzbekistan":"🇺🇿","Vanuatu":"🇻🇺","Vatican City":"🇻🇦",
  "Venezuela":"🇻🇪","Vietnam":"🇻🇳","Yemen":"🇾🇪","Zambia":"🇿🇲","Zimbabwe":"🇿🇼",
};

export function uid() { return Math.random().toString(36).slice(2,10); }

// YYYYMMDD ↔ Date
export function ymdToDate(s) {
  return new Date(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8));
}
export function dateToYMD(d) {
  return String(d.getFullYear()) +
    String(d.getMonth()+1).padStart(2,'0') +
    String(d.getDate()).padStart(2,'0');
}

// Format for input[type=date]: YYYY-MM-DD
export function fmtYMD(s) { return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8); }
// Strip both slashes and dashes so YYYY-MM-DD and YYYY/MM/DD both → YYYYMMDD
export function parseYMD(s) { return s.replace(/[-/]/g,''); }

export function calKey(year, month, day) {
  return String(year) + String(month+1).padStart(2,'0') + String(day).padStart(2,'0');
}
export function daysInMonth(year, month) {
  return new Date(year, month+1, 0).getDate();
}
export function firstDOW(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0
}

export function buildDayMap(stays, events) {
  const dayMap = {}, eventMap = {};
  stays.forEach(stay => {
    let d = ymdToDate(stay.start);
    const e = ymdToDate(stay.end);
    let isFirst = true;
    while (d < e) {
      const key = dateToYMD(d);
      if (!dayMap[key]) dayMap[key] = { ...stay, isFirst };
      isFirst = false;
      d.setDate(d.getDate()+1);
    }
  });
  events.forEach(ev => {
    let d = ymdToDate(ev.start);
    const e = ymdToDate(ev.end);
    let isFirst = true;
    while (d <= e) {
      const key = dateToYMD(d);
      if (!eventMap[key]) eventMap[key] = [];
      eventMap[key].push({ ...ev, isFirst });
      isFirst = false;
      d.setDate(d.getDate()+1);
    }
  });
  return { dayMap, eventMap };
}

// Derive whether a trip is booked
export function isTripBooked(trip) {
  function legBooked(leg) {
    if (!leg) return true;
    if (leg.confirmed !== null && leg.confirmed !== undefined) return leg.confirmed;
    return !!leg.booking_ref;
  }
  function accomBooked(accom) {
    if (!accom) return true;
    if (accom.booked !== null && accom.booked !== undefined) return accom.booked;
    return !!accom.booking_ref;
  }
  // If no structured booking data, use the explicit booked flag
  if (!trip.flight_in && !trip.flight_out && !trip.accom) {
    return !!trip.booked;
  }
  return legBooked(trip.flight_in) && legBooked(trip.flight_out) && accomBooked(trip.accom);
}

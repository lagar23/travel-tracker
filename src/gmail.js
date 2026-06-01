// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Fetch helpers
// ─────────────────────────────────────────────────────────────────────────────

const GMAIL_SEARCH = [
  'from:(ryanair.com OR iberia.com OR easyjet.com OR vueling.com OR aerlingus.com OR',
  'aireuropa.com OR lufthansa.com OR ba.com OR klm.com OR airfrance.com OR',
  'norwegian.com OR wizzair.com OR transavia.com OR united.com OR delta.com OR',
  'aa.com OR emirates.com OR flydubai.com OR qatarairways.com OR turkishairlines.com OR',
  'booking.com OR airbnb.com OR agoda.com OR hotels.com OR hostelworld.com OR',
  'renfe.es OR alsa.es OR ouibus.com OR flixbus.com OR eurostar.com OR blablacar.com)',
  'OR subject:(confirmation OR reservation OR booking OR itinerary OR',
  '"your trip" OR "flight details" OR "check-in" OR "check in" OR',
  '"viaje confirmado" OR "reserva confirmada" OR "billete" OR',
  '"your reservation" OR "booking reference" OR "order confirmation")',
  'after:2024/01/01',
].join(' ');

export const LAST_ID_KEY = 'gmailLastMessageId';

async function fetchMessageIds(token, afterDate) {
  const q = afterDate ? `${GMAIL_SEARCH} after:${afterDate}` : GMAIL_SEARCH;
  const base = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500&q=${encodeURIComponent(q)}`;
  const ids = [];
  let pageToken = null;
  do {
    const url = pageToken ? `${base}&pageToken=${pageToken}` : base;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw Object.assign(new Error('Gmail fetch failed'), { status: res.status });
    const data = await res.json();
    if (data.messages) ids.push(...data.messages.map(m => m.id));
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);
  return ids;
}

async function fetchMessage(token, id) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchMessages(token, ids) {
  const results = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const fetched = await Promise.all(batch.map(id => fetchMessage(token, id)));
    results.push(...fetched.filter(Boolean));
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Email body helpers
// ─────────────────────────────────────────────────────────────────────────────

function getHeader(msg, name) {
  return msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function decodeBody(msg) {
  function decode(part) {
    if (part.body?.data) {
      return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.parts) return part.parts.map(decode).join('');
    return '';
  }
  return decode(msg.payload);
}

function gmailUrl(id) {
  return `https://mail.google.com/mail/u/0/#inbox/${id}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Per-sender parsers
// ─────────────────────────────────────────────────────────────────────────────

const PARSERS = [
  {
    name: 'ryanair',
    test: (s) => s.includes('ryanair.com'),
    parse(body, subject, sender, msgId) {
      const refM  = subject.match(/\b([A-Z0-9]{6})\b/) || body.match(/booking\s+(?:reference|ref)[:\s]+([A-Z0-9]{6})/i);
      const routeM  = body.match(/\b([A-Z]{3})\s*[→\-–to]+\s*([A-Z]{3})\b/i);
      const dateM   = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'Ryanair' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'iberia',
    test: (s) => s.includes('iberia.com'),
    parse(body, subject, sender, msgId) {
      const refM   = body.match(/localizador[:\s]+([A-Z0-9]{6})/i) || subject.match(/\b([A-Z0-9]{6})\b/);
      const routeM  = body.match(/\b([A-Z]{3})\s*[→\-–]+\s*([A-Z]{3})\b/i);
      const dateM   = body.match(/\b(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'Iberia' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'vueling',
    test: (s) => s.includes('vueling.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/(?:booking\s+ref(?:erence)?|localizador|confirmation)[:\s]+([A-Z0-9]{6})/i) || subject.match(/\b([A-Z0-9]{6})\b/);
      const routeM = body.match(/\b([A-Z]{3})\s*[→\-–]+\s*([A-Z]{3})\b/i);
      const dateM  = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'Vueling' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'aerlingus',
    test: (s) => s.includes('aerlingus.com'),
    parse(body, subject, sender, msgId) {
      const refM   = body.match(/booking\s+reference[:\s]+([A-Z0-9]{6})/i) || subject.match(/\b([A-Z0-9]{6})\b/);
      const routeM  = body.match(/\b([A-Z]{3})\s*[→\-–to]+\s*([A-Z]{3})\b/i);
      const dateM   = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'Aer Lingus' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'easyjet',
    test: (s) => s.includes('easyjet.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/booking\s+reference[:\s]+([A-Z0-9]{6,8})/i) || subject.match(/\b([A-Z0-9]{6,8})\b/);
      const routeM = body.match(/\b([A-Z]{3})\s*[→\-–to]+\s*([A-Z]{3})\b/i);
      const dateM  = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM[1], carrier: 'easyJet' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'renfe',
    test: (s) => s.includes('renfe.es'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/localizador[:\s]+([A-Z0-9]{6,10})/i) || subject.match(/\b([A-Z0-9]{6,10})\b/);
      const routeM = body.match(/\b([A-ZÀ-ɏ ]+)\s*[→\-–]+\s*([A-ZÀ-ɏ ]+)\b/i);
      const dateM  = body.match(/\b(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (!refM) return null;
      const dateStart = dateM ? `${dateM[3]}${dateM[2].padStart(2,'0')}${dateM[1].padStart(2,'0')}` : null;
      return {
        type: 'train',
        inbound:  { date: dateStart, origin: routeM?.[1]?.trim() || '', destination: routeM?.[2]?.trim() || '', ref: refM[1], carrier: 'Renfe' },
        outbound: null,
        dateStart,
        dateEnd: null,
        country: 'Spain',
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'alsa',
    test: (s) => s.includes('alsa.es'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/localizador[:\s]+([A-Z0-9]{6,10})/i) || subject.match(/\b([A-Z0-9]{6,10})\b/);
      const dateM  = body.match(/\b(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (!refM) return null;
      const dateStart = dateM ? `${dateM[3]}${dateM[2].padStart(2,'0')}${dateM[1].padStart(2,'0')}` : null;
      return {
        type: 'bus',
        inbound:  { date: dateStart, origin: '', destination: '', ref: refM[1], carrier: 'ALSA' },
        outbound: null,
        dateStart,
        dateEnd: null,
        country: 'Spain',
        ref: refM[1],
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'airbnb',
    test: (s) => s.includes('airbnb.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/confirmation\s+code[:\s]+([A-Z0-9]{8,12})/i) || subject.match(/([A-Z0-9]{8,12})/);
      const checkInM  = body.match(/check.in[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const checkOutM = body.match(/check.out[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const dateStart = checkInM  ? parseFreeDate(checkInM[1])  : null;
      const dateEnd   = checkOutM ? parseFreeDate(checkOutM[1]) : null;
      if (!refM && !dateStart) return null;
      const propertyM = body.match(/(?:you(?:'re|\s+are)\s+(?:going\s+to|staying\s+at)|your\s+(?:trip\s+to|reservation\s+at))\s+([^\n,\.]{3,60})/i)
                     || body.match(/property\s+name[:\s]+([^\n]{3,60})/i);
      return {
        type: 'accommodation',
        inbound:  { date: dateStart, origin: null, destination: propertyM?.[1]?.trim() || '', ref: refM?.[1] || '', carrier: 'Airbnb' },
        outbound: null,
        dateStart,
        dateEnd,
        country: null,
        ref: refM?.[1] || '',
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'booking',
    test: (s) => s.includes('booking.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/confirmation\s+number[:\s]+(\d{10,12})/i) || subject.match(/(\d{10,12})/);
      const checkInM  = body.match(/check.in[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const checkOutM = body.match(/check.out[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const dateStart = checkInM  ? parseFreeDate(checkInM[1])  : null;
      const dateEnd   = checkOutM ? parseFreeDate(checkOutM[1]) : null;
      if (!refM && !dateStart) return null;
      const propertyM = body.match(/(?:your\s+reservation\s+at|staying\s+at)\s+([^\n,\.]{3,60})/i)
                     || body.match(/property\s+name[:\s]+([^\n]{3,60})/i);
      return {
        type: 'accommodation',
        inbound:  { date: dateStart, origin: null, destination: propertyM?.[1]?.trim() || '', ref: refM?.[1] || '', carrier: 'Booking.com' },
        outbound: null,
        dateStart,
        dateEnd,
        country: null,
        ref: refM?.[1] || '',
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'agoda',
    test: (s) => s.includes('agoda.com'),
    parse(body, subject, sender, msgId) {
      const refM  = body.match(/booking\s+(?:id|ref|number)[:\s]+([A-Z0-9\-]{5,15})/i) || subject.match(/([A-Z0-9]{8,15})/);
      const checkInM  = body.match(/check.in[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const checkOutM = body.match(/check.out[:\s]+(\w+ \d+, \d{4}|\d{1,2} \w+ \d{4})/i);
      const dateStart = checkInM  ? parseFreeDate(checkInM[1])  : null;
      const dateEnd   = checkOutM ? parseFreeDate(checkOutM[1]) : null;
      if (!refM && !dateStart) return null;
      const propertyM = body.match(/hotel\s+name[:\s]+([^\n]{3,60})/i)
                     || body.match(/staying\s+at[:\s]+([^\n,\.]{3,60})/i);
      return {
        type: 'accommodation',
        inbound:  { date: dateStart, origin: null, destination: propertyM?.[1]?.trim() || '', ref: refM?.[1] || '', carrier: 'Agoda' },
        outbound: null,
        dateStart,
        dateEnd,
        country: null,
        ref: refM?.[1] || '',
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
  {
    name: 'generic-flight',
    test: (_s, subject) => /confirmation|booking|itinerary|billete/i.test(subject),
    parse(body, subject, sender, msgId) {
      const routeM = body.match(/\b([A-Z]{3})\s*[→\-–]+\s*([A-Z]{3})\b/);
      const refM   = body.match(/(?:booking\s+ref(?:erence)?|confirmation\s+(?:number|code)|localizador)[:\s]+([A-Z0-9]{5,12})/i);
      const dateM  = body.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
      if (!routeM && !refM) return null;
      const dateStart = dateM ? normaliseDate(dateM[1], dateM[2], dateM[3]) : null;
      return {
        type: 'flight',
        inbound:  routeM ? { date: dateStart, origin: routeM[1], destination: routeM[2], ref: refM?.[1] || '', carrier: '' } : null,
        outbound: null,
        dateStart,
        dateEnd: null,
        country: routeM ? airportCountry(routeM[2]) : null,
        ref: refM?.[1] || '',
        subject,
        sender,
        gmailUrl: gmailUrl(msgId),
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Date normalisation and airport helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS_SHORT = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  ene:'01',abr:'04',ago:'08' };

function normaliseDate(day, monthStr, year) {
  const m = MONTHS_SHORT[monthStr.toLowerCase().slice(0,3)];
  if (!m) return null;
  return `${year}${m}${String(day).padStart(2,'0')}`;
}

function parseFreeDate(str) {
  const m1 = str.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  const m2 = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (m1) return normaliseDate(m1[2], m1[1], m1[3]);
  if (m2) return normaliseDate(m2[1], m2[2], m2[3]);
  return null;
}

export const AIRPORT_COUNTRY = {
  MAD:'Spain', BCN:'Spain', AGP:'Spain', ALC:'Spain', PMI:'Spain', SVQ:'Spain', VLC:'Spain',
  DUB:'Ireland', ORK:'Ireland', SNN:'Ireland',
  LHR:'UK', LGW:'UK', LTN:'UK', STN:'UK', MAN:'UK', EDI:'UK',
  CDG:'France', ORY:'France', NCE:'France',
  FCO:'Italy', MXP:'Italy', VCE:'Italy', NAP:'Italy',
  AMS:'Netherlands', BRU:'Belgium', ZRH:'Switzerland',
  FRA:'Germany', MUC:'Germany', BER:'Germany',
  LIS:'Portugal', OPO:'Portugal', FAO:'Portugal',
  BKK:'Thailand', DMK:'Thailand',
  JFK:'USA', LAX:'USA', ORD:'USA', BOS:'USA', MIA:'USA', SFO:'USA',
  YYZ:'Canada', YUL:'Canada', YVR:'Canada',
  DXB:'UAE', AUH:'UAE',
  DOH:'Qatar', IST:'Turkey',
};

export const AIRPORT_CITY = {
  MAD:'Madrid', BCN:'Barcelona', AGP:'Málaga', ALC:'Alicante', PMI:'Palma', SVQ:'Seville', VLC:'Valencia',
  DUB:'Dublin', ORK:'Cork', SNN:'Shannon',
  LHR:'London', LGW:'London', LTN:'London', STN:'London', MAN:'Manchester', EDI:'Edinburgh',
  CDG:'Paris', ORY:'Paris', NCE:'Nice',
  FCO:'Rome', MXP:'Milan', VCE:'Venice', NAP:'Naples',
  AMS:'Amsterdam', BRU:'Brussels', ZRH:'Zurich',
  FRA:'Frankfurt', MUC:'Munich', BER:'Berlin',
  LIS:'Lisbon', OPO:'Porto', FAO:'Faro',
  BKK:'Bangkok', DMK:'Bangkok',
  JFK:'New York', LAX:'Los Angeles', ORD:'Chicago', BOS:'Boston', MIA:'Miami', SFO:'San Francisco',
  YYZ:'Toronto', YUL:'Montreal', YVR:'Vancouver',
  DXB:'Dubai', AUH:'Abu Dhabi',
  DOH:'Doha', IST:'Istanbul',
  ORK:'Cork', SNN:'Shannon',
  GRX:'Granada', MRS:'Marseille', VIE:'Vienna', PRG:'Prague', WAW:'Warsaw',
  ATH:'Athens', SKG:'Thessaloniki', HER:'Heraklion',
  CPH:'Copenhagen', ARN:'Stockholm', OSL:'Oslo', HEL:'Helsinki',
  KEF:'Reykjavik', DUB:'Dublin',
  NBO:'Nairobi', CPT:'Cape Town', JNB:'Johannesburg',
  SYD:'Sydney', MEL:'Melbourne', BNE:'Brisbane',
  NRT:'Tokyo', HND:'Tokyo', KIX:'Osaka', NGO:'Nagoya',
  ICN:'Seoul', PEK:'Beijing', PVG:'Shanghai', HKG:'Hong Kong',
  SIN:'Singapore', KUL:'Kuala Lumpur', CGK:'Jakarta',
  BOM:'Mumbai', DEL:'Delhi', BLR:'Bangalore', MAA:'Chennai',
  GRU:'São Paulo', EZE:'Buenos Aires', SCL:'Santiago', BOG:'Bogotá', LIM:'Lima',
  ALA:'Almaty', TSE:'Astana',
};

export function airportCity(iata) {
  return AIRPORT_CITY[iata?.toUpperCase()] ?? iata?.toUpperCase() ?? '';
}

export function airportCountry(iata) {
  return AIRPORT_COUNTRY[iata?.toUpperCase()] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Parse + match logic + scanGmail export
// ─────────────────────────────────────────────────────────────────────────────

function parseMessage(msg) {
  const sender  = getHeader(msg, 'from').toLowerCase();
  const subject = getHeader(msg, 'subject');
  const body    = decodeBody(msg);

  for (const parser of PARSERS) {
    if (parser.test(sender, subject)) {
      try {
        const booking = parser.parse(body, subject, sender, msg.id);
        if (booking) return booking;
      } catch {
        // silently drop parse errors
      }
    }
  }
  return null;
}

function matchBooking(booking, stays) {
  if (!booking.dateStart) return null;
  const ds = booking.dateStart;
  const candidates = stays.filter(s => ds >= s.start && ds <= s.end);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const countryMatch = candidates.find(s => s.country === booking.country);
  return countryMatch ?? candidates[0];
}

export async function scanGmail(accessToken, stays) {
  const lastId = localStorage.getItem(LAST_ID_KEY) ?? null;
  let ids;
  try {
    ids = await fetchMessageIds(accessToken, lastId);
  } catch (err) {
    if (err.status === 403) throw Object.assign(err, { code: 'NO_GMAIL_SCOPE' });
    throw err;
  }

  if (ids.length === 0) return { matched: [], unmatched: [], lastMessageId: lastId };

  const messages = await fetchMessages(accessToken, ids);
  const bookings = messages.map(parseMessage).filter(Boolean);

  const matched   = [];
  const unmatched = [];

  for (const booking of bookings) {
    const stay = matchBooking(booking, stays);
    if (stay) {
      matched.push({ booking, stay });
    } else {
      unmatched.push(booking);
    }
  }

  // Store a YYYY/MM/DD date cursor (Gmail's after: operator expects a date, not a message ID)
  const newestMsg = messages[0];
  const cursorDate = newestMsg?.internalDate
    ? new Date(parseInt(newestMsg.internalDate)).toISOString().slice(0, 10).replace(/-/g, '/')
    : null;
  if (cursorDate) localStorage.setItem(LAST_ID_KEY, cursorDate);

  return { matched, unmatched, lastMessageId: cursorDate };
}

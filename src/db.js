import { getSupabase } from './auth.js';

// YYYYMMDD → YYYY-MM-DD (for Supabase)
function toIso(ymd) {
  return ymd.slice(0,4) + '-' + ymd.slice(4,6) + '-' + ymd.slice(6,8);
}
// YYYY-MM-DD → YYYYMMDD (for app)
function fromIso(iso) {
  return iso.replace(/-/g,'');
}

function tripToApp(row) {
  return {
    id:       row.id,
    type:     'stay',
    label:    row.label,
    country:  row.country,
    flag:     row.flag,
    cssClass: row.css_class,
    start:    fromIso(row.start_date),
    end:      fromIso(row.end_date),
    note:     row.note,
    source:   row.source,
    booking_ref: row.booking_ref,
    provider: row.provider,
    flight_in:  row.flight_in,
    flight_out: row.flight_out,
    accom:    row.accom,
    // derive booked for backwards compat with calendar render
    booked: row.flight_in || row.flight_out || row.accom
      ? (legBooked(row.flight_in) && legBooked(row.flight_out) && accomBooked(row.accom))
      : false,
  };
}

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

function eventToApp(row) {
  return {
    id:      row.id,
    type:    'event',
    label:   row.label,
    start:   fromIso(row.start_date),
    end:     fromIso(row.end_date),
    color:   row.color,
    note:    row.note,
    trip_id: row.trip_id,
    source:  row.source,
  };
}

export async function getTrips() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('trips')
    .select('*')
    .order('start_date');
  if (error) throw error;
  return data.map(tripToApp);
}

export async function saveTrip(trip) {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  const row = {
    user_id:    session.user.id,
    label:      trip.label,
    country:    trip.country,
    flag:       trip.flag,
    css_class:  trip.cssClass,
    start_date: toIso(trip.start),
    end_date:   toIso(trip.end),
    note:       trip.note || '',
    source:     trip.source || 'manual',
    booking_ref: trip.booking_ref || null,
    provider:   trip.provider || null,
    flight_in:  trip.flight_in  || null,
    flight_out: trip.flight_out || null,
    accom:      trip.accom || null,
  };
  if (trip.id) {
    const { error } = await sb.from('trips').update(row).eq('id', trip.id);
    if (error) throw error;
  } else {
    const { data, error } = await sb.from('trips').insert(row).select().single();
    if (error) throw error;
    return data.id;
  }
}

export async function deleteTrip(id) {
  const sb = getSupabase();
  const { error } = await sb.from('trips').delete().eq('id', id);
  if (error) throw error;
}

export async function getEvents() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('events')
    .select('*')
    .order('start_date');
  if (error) throw error;
  return data.map(eventToApp);
}

export async function saveEvent(event) {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  const row = {
    user_id:    session.user.id,
    label:      event.label,
    start_date: toIso(event.start),
    end_date:   toIso(event.end),
    color:      event.color,
    note:       event.note || '',
    trip_id:    event.trip_id || null,
    source:     event.source || 'manual',
  };
  if (event.id) {
    const { error } = await sb.from('events').update(row).eq('id', event.id);
    if (error) throw error;
  } else {
    const { data, error } = await sb.from('events').insert(row).select().single();
    if (error) throw error;
    return data.id;
  }
}

export async function deleteEvent(id) {
  const sb = getSupabase();
  const { error } = await sb.from('events').delete().eq('id', id);
  if (error) throw error;
}

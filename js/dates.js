/** Date helpers for America/New_York civil dates (YYYY-MM-DD). */

export const TZ = "America/New_York";

export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const next = new Date(utc + days * 86400000);
  return next.toISOString().slice(0, 10);
}

export function diffDays(fromISO, toISO) {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function weekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isTuesday(iso) {
  return weekday(iso) === 2;
}

export function nextTuesdayOnOrAfter(iso) {
  let d = iso;
  while (!isTuesday(d)) d = addDays(d, 1);
  return d;
}

export function upcomingTuesdays(fromISO, count = 8) {
  let t = nextTuesdayOnOrAfter(fromISO);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(t);
    t = addDays(t, 7);
  }
  return out;
}

export function plantDateForHarvest(harvestISO, daysToHarvest) {
  return addDays(harvestISO, -daysToHarvest);
}

export function nextOnTimeCycle(daysToHarvest, today, tuesdays) {
  for (const harvest of tuesdays) {
    const plant = plantDateForHarvest(harvest, daysToHarvest);
    if (plant >= today) return { plant, harvest, late: false };
  }
  const harvest = tuesdays[tuesdays.length - 1];
  return {
    plant: plantDateForHarvest(harvest, daysToHarvest),
    harvest,
    late: true,
  };
}

export function prettyDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export function prettyDateLong(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export function weekdayName(iso) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[weekday(iso)];
}

import { Course, COURSES } from "./courses";

/**
 * Kenna API response types — only the fields we actually use.
 * See ~/.hermes/skills/web/teeitup-kenna-teetimes-api/SKILL.md
 */
export type KennaRate = {
  _id: number;
  name: string;
  holes: number;
  allowedPlayers: number[];
  greenFeeCart?: number;     // cents
  greenFeeWalking?: number;  // cents
  greenFeeRiding?: number;   // cents
  greenFee?: number;         // cents (catch-all)
  tags?: string[];
};

export type KennaTeeTime = {
  courseId: string;
  teetime: string;           // UTC ISO with Z
  backNine: boolean;
  rates: KennaRate[];
  bookedPlayers: number;
  minPlayers: number;
  maxPlayers: number;
  players: unknown[];
};

export type KennaFacilityResponse = {
  courseId: string;
  totalAvailableTeetimes: number;
  teetimes: KennaTeeTime[];
};

export type EnrichedRate = {
  name: string;
  feeCents: number | null;
  holes: number;
};

export type EnrichedTeeTime = {
  courseId: string;          // which Course.id this belongs to
  courseName: string;
  bookingUrl: string;
  startUtc: string;          // raw ISO
  startLocal: string;        // ISO in America/Chicago
  startLabel: string;        // human label e.g. "Sat 7:04 AM"
  feeCents: number | null;    // best public fee
  rateName: string;
  holes: number;
  bookedPlayers: number;
  maxPlayers: number;
  openSlots: number;         // maxPlayers - bookedPlayers
  isOpen: boolean;
};

/** Pick the cheapest non-member rate. Returns the rate and its fee (cents). */
export function pickBestRate(slot: KennaTeeTime): {
  rate: KennaRate | null;
  feeCents: number | null;
} {
  const candidates: { fee: number; rate: KennaRate }[] = [];
  for (const r of slot.rates || []) {
    const name = (r.name || "").toLowerCase();
    if (name.includes("member")) continue;
    const fee =
      r.greenFeeCart ??
      r.greenFeeWalking ??
      r.greenFeeRiding ??
      r.greenFee ??
      null;
    if (fee && fee > 0) candidates.push({ fee, rate: r });
  }
  if (candidates.length === 0) {
    // Fallback: any non-member rate with no fee data
    for (const r of slot.rates || []) {
      if (!(r.name || "").toLowerCase().includes("member")) {
        return { rate: r, feeCents: null };
      }
    }
    return { rate: null, feeCents: null };
  }
  candidates.sort((a, b) => a.fee - b.fee);
  return { rate: candidates[0].rate, feeCents: candidates[0].fee };
}

/**
 * Format a UTC ISO timestamp as a CT (America/Chicago) local label.
 * Note: JS Intl handles CDT/CST correctly via the IANA tz — no hardcoded offset.
 */
export function formatLocal(iso: string): { label: string; isoLocal: string } {
  const d = new Date(iso);
  const label = d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  // Example: "Sat 7:04 AM"
  const cleanLabel = label.replace(/\s+/g, " ").replace(",", "").trim();
  // ISO in CT for downstream sort/grouping
  const isoLocal = d.toLocaleString("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace(",", "");
  return { label: cleanLabel, isoLocal };
}

export type FetchOptions = {
  /** Fetch this many days starting today. Default 3, max 7. */
  days?: number;
  /** Optional signal for fetch timeout / cancellation. */
  signal?: AbortSignal;
};

export type FetchResult = {
  fetchedAt: string;
  daysRequested: number;
  teetimes: EnrichedTeeTime[];
  fetchErrors: string[];
};

/**
 * Fetch teetimes for ALL registered courses over the next N days,
 * hitting Kenna once per course/date in parallel.
 */
export async function fetchAllTeetimes(opts: FetchOptions = {}): Promise<FetchResult> {
  const days = Math.max(1, Math.min(opts.days ?? 3, 7));
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const tasks: Promise<EnrichedTeeTime[]>[] = [];
  const fetchErrors: string[] = [];

  for (const course of COURSES) {
    for (const date of dates) {
      tasks.push(
        fetchCourseDay(course, date).catch((err) => {
          fetchErrors.push(`${course.name} ${date}: ${err?.message || err}`);
          return [];
        })
      );
    }
  }

  const results = await Promise.all(tasks);
  const flat = results.flat();

  // Sort by local CT start time
  flat.sort((a, b) => a.startLocal.localeCompare(b.startLocal));

  return {
    fetchedAt: new Date().toISOString(),
    daysRequested: days,
    teetimes: flat,
    fetchErrors,
  };
}

/** Fetch teetimes for one course/date and enrich. */
async function fetchCourseDay(course: Course, date: string): Promise<EnrichedTeeTime[]> {
  const url = `https://phx-api-be-east-1b.kenna.io/v2/tee-times?date=${date}&facilityIds=${course.facilityId}`;
  const r = await fetch(url, {
    headers: {
      "x-be-alias": course.slug,
      accept: "application/json, text/plain, */*",
      referer: `https://${course.slug}.book.teeitup.com/`,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    },
    // Cache at the edge for 60s — Kenna data changes minute-by-minute,
    // no point hammering their API for every page load.
    next: { revalidate: 60 },
  } as RequestInit & { next?: { revalidate?: number } });
  if (!r.ok) {
    throw new Error(`Kenna HTTP ${r.status}`);
  }
  const data: KennaFacilityResponse[] = await r.json();

  const out: EnrichedTeeTime[] = [];
  for (const facility of data) {
    for (const slot of facility.teetimes || []) {
      const { rate, feeCents } = pickBestRate(slot);
      if (!rate) continue;
      const { label, isoLocal } = formatLocal(slot.teetime);
      const booked = slot.bookedPlayers || 0;
      const maxP = slot.maxPlayers || 4;
      out.push({
        courseId: course.id,
        courseName: course.name,
        bookingUrl: course.bookingUrl,
        startUtc: slot.teetime,
        startLocal: isoLocal,
        startLabel: label,
        feeCents,
        rateName: rate.name,
        holes: rate.holes || course.holes || 18,
        bookedPlayers: booked,
        maxPlayers: maxP,
        openSlots: Math.max(0, maxP - booked),
        isOpen: maxP - booked > 0,
      });
    }
  }
  return out;
}
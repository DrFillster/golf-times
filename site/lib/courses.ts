/**
 * Course registry — only TeeItUp/Kenna-backed courses in v1.
 * To add a new course: open its booking site in a browser, capture the
 * facilityIds=NNNN value from the kenna.io teetimes request, add it here.
 *
 * EXCLUDED VENDORS (recon notes — 2026-06-22):
 *
 * Stevens Park (Dallas Muni) — appears to use ProphetServices at
 * secure.west.prophetservices.com/StevensParkv3/ (302 redirect + per-session
 * (S(token)) routing), but the course's own website only exposes a phone
 * number for bookings; the ProphetServices backend is not linked publicly.
 * Per Philip: "Stevens is strictly phone calls" — confirmed by their
 * /bookteetimes page which has no booking iframe or external link, just
 * "Reservations: 214.670.7506". Out of scope until/unless the course
 * exposes the ProphetServices URL.
 *
 * Tenison Park / Tenison Highlands / Tenison Glen (Dallas Muni) — same
 * facility, two 18-hole courses. Booking backend is CPS Golf
 * (dallastenison.cps.golf), an ASP.NET MVC booking app branded under CPS
 * (also called ProphetServices — same cookie fingerprint
 * `CPS.Online3.CurrentUICulture` observed on both domains). Cloudflare
 * bot-challenge at the edge blocks all curl and headless Chrome traffic
 * (HTTP 403 "Just a moment..."). Requires the user's real Safari via
 * CUA, or vendor outreach. Out of scope for v1.
 *
 * Keeton Park, L.B. Houston, Lake June (Dallas Munis) — TeeItUp tenants do
 * NOT exist for these slugs (Kenna returns 400 / 404 "Booking Engine Settings
 * not found"). Likely CPS/ProphetServices like Tenison Park. Not yet probed.
 *
 * Arcis Dallas (Cowboys GC, Bear Creek, Fossil Creek, Lake Park LV, Twin Creeks,
 * Mansfield National) — book through texas.arcisgolf.com. No JSON endpoint
 * discovered; widget is JS-rendered. Same Browserbase/CUA approach would apply.
 *
 * TPC courses (TPC Craig Ranch, TPC Four Seasons) — ForeUP, geo-fenced
 * 2-3 day window, headless-detected. Out of scope for v1.
 *
 * TeeItUp tenants that return 0 public slots (Texas Star, Iron Horse,
 * Indian Creek, Bridlewood, Westport) — courses exist on the TeeItUp
 * platform but the tenant config doesn't release public tee times through
 * the API. Likely member-only or private clubs using TeeItUp as a booking
 * white-label. Vendor relationship required to enable public release.
 */
export type Course = {
  id: string;          // URL-safe id used in /api/teetimes?course=...
  name: string;
  slug: string;        // TeeItUp booking-engine subdomain
  facilityId: number;
  bookingUrl: string;  // Where the user clicks "Book"
  holes?: 9 | 18;      // default hole count if all slots are uniform
};

export const COURSES: Course[] = [
  {
    id: "irving",
    name: "Irving Golf Club",
    slug: "irving-golf-club",
    facilityId: 3186,
    bookingUrl: "https://irving-golf-club.book.teeitup.com/",
    holes: 18,
  },
  {
    id: "prairie-lakes",
    name: "Prairie Lakes",
    slug: "prairie-lakes-golf-course",
    facilityId: 1311,
    bookingUrl: "https://prairie-lakes-golf-course.book.teeitup.com/",
    holes: 18,
  },
  {
    id: "golf-ranch-richardson",
    name: "Golf Ranch Richardson",
    slug: "golf-ranch-richardson",
    facilityId: 18438,
    bookingUrl: "https://golf-ranch-richardson.book.teeitup.com/",
    holes: 9,
  },
  {
    id: "duck-creek",
    name: "Duck Creek Golf Club",
    slug: "duck-creek-golf-club",
    facilityId: 10769,
    bookingUrl: "https://duck-creek-golf-club.book.teeitup.com/",
    holes: 18,
  },
  // v1.1 additions — recon 2026-06-22 (Philip: "find other munis to scrape")
  {
    id: "cedar-crest",
    name: "Cedar Crest Golf Club",
    slug: "cedar-crest-golf-club",
    facilityId: 5287,
    bookingUrl: "https://cedar-crest-golf-club.book.teeitup.com/",
    holes: 18,
  },
  {
    id: "tangle-ridge",
    name: "Tangle Ridge Golf Club",
    slug: "tangle-ridge-golf-club",
    facilityId: 846,
    bookingUrl: "https://tangle-ridge-golf-club.book.teeitup.com/",
    holes: 18,
  },
  {
    id: "riverside",
    name: "Riverside Golf Club",
    slug: "riverside-golf-club",
    facilityId: 2338,
    bookingUrl: "https://riverside-golf-club.book.teeitup.com/",
    holes: 18,
  },
  {
    id: "oak-hollow",
    name: "Oak Hollow Golf Course",
    slug: "oak-hollow-golf-course",
    facilityId: 42,
    bookingUrl: "https://oak-hollow-golf-course.book.teeitup.com/",
    holes: 18,
  },
  {
    id: "coyote-ridge",
    name: "Coyote Ridge Golf Club",
    slug: "coyote-ridge-golf-club",
    facilityId: 1261,
    bookingUrl: "https://coyote-ridge-golf-club.book.teeitup.com/",
    holes: 18,
  },
];

export function courseById(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}
/**
 * Course registry — only TeeItUp/Kenna-backed courses in v1.
 * To add a new course: open its booking site in a browser, capture the
 * facilityIds=NNNN value from the kenna.io teetimes request, add it here.
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
];

export function courseById(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}
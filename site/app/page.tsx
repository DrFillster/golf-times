"use client";

import { useEffect, useMemo, useState } from "react";

type TeeTime = {
  courseId: string;
  courseName: string;
  bookingUrl: string;
  startUtc: string;
  startLocal: string;
  startLabel: string;
  feeCents: number | null;
  rateName: string;
  holes: number;
  bookedPlayers: number;
  maxPlayers: number;
  openSlots: number;
  isOpen: boolean;
};

type ApiResponse = {
  ok: boolean;
  fetchedAt: string;
  count: number;
  items: TeeTime[];
  fetchErrors?: string[];
  error?: string;
};

type Course = {
  id: string;
  name: string;
};

const COURSES: Course[] = [
  { id: "all", name: "All courses" },
  { id: "irving", name: "Irving Golf Club" },
  { id: "prairie-lakes", name: "Prairie Lakes" },
  { id: "golf-ranch-richardson", name: "Golf Ranch Richardson" },
  { id: "duck-creek", name: "Duck Creek" },
  // v1.1 additions — recon 2026-06-22 (Philip: "find other munis to scrape")
  { id: "cedar-crest", name: "Cedar Crest" },
  { id: "tangle-ridge", name: "Tangle Ridge" },
  { id: "riverside", name: "Riverside (Grand Prairie)" },
  { id: "oak-hollow", name: "Oak Hollow" },
  { id: "coyote-ridge", name: "Coyote Ridge" },
];

function feeLabel(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(0)}`;
}

function relativeTime(iso: string): string {
  const fetched = new Date(iso);
  const now = new Date();
  const sec = Math.round((now.getTime() - fetched.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [course, setCourse] = useState("all");
  const [days, setDays] = useState(3);
  const [maxFee, setMaxFee] = useState<string>(""); // empty = no cap
  const [timeOfDay, setTimeOfDay] = useState("any");
  const [openOnly, setOpenOnly] = useState(true);
  const [nineOnly, setNineOnly] = useState(false);
  const [twosomeOnly, setTwosomeOnly] = useState(false);

  // Build query
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("days", String(days));
    if (course !== "all") p.set("course", course);
    if (maxFee) p.set("maxFee", maxFee);
    if (timeOfDay !== "any") p.set("timeOfDay", timeOfDay);
    if (openOnly) p.set("openOnly", "1");
    return p.toString();
  }, [days, course, maxFee, timeOfDay, openOnly]);

  // Fetch when query changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/teetimes?${qs}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        if (cancelled) return;
        if (!d.ok) {
          setError(d.error || "Unknown error");
          setData(null);
        } else {
          setData(d);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || "Network error");
        setData(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qs]);

  // Client-side additional filtering (9-only, twosome-only)
  const items = useMemo(() => {
    if (!data) return [];
    return data.items.filter((t) => {
      if (nineOnly && t.holes !== 9) return false;
      if (twosomeOnly && t.maxPlayers !== 2) return false;
      return true;
    });
  }, [data, nineOnly, twosomeOnly]);

  // Group by date (parsed from startLocal YYYY-MM-DD HH:MM)
  const grouped = useMemo(() => {
    const m = new Map<string, TeeTime[]>();
    for (const t of items) {
      const date = t.startLocal.slice(0, 10);
      if (!m.has(date)) m.set(date, []);
      m.get(date)!.push(t);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const openCount = items.filter((t) => t.isOpen).length;
  const statusClass = loading ? "loading" : error ? "error" : "";
  const statusText = loading
    ? "loading…"
    : error
    ? `error: ${error}`
    : `${items.length} slots · ${openCount} open · updated ${relativeTime(data!.fetchedAt)}`;

  return (
    <main>
      <header>
        <h1>⛳ Dallas Open Tee Times</h1>
        <p>4 public courses within 15 mi of Lower Greenville. Polled from TeeItUp/Kenna.</p>
      </header>

      <div className="controls">
        <div className="control">
          <label htmlFor="course">Course</label>
          <select id="course" value={course} onChange={(e) => setCourse(e.target.value)}>
            {COURSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="control">
          <label htmlFor="days">Days ahead</label>
          <select id="days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="control">
          <label htmlFor="time">Time of day</label>
          <select id="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)}>
            <option value="any">Any time</option>
            <option value="morning">Morning (5a–noon)</option>
            <option value="afternoon">Afternoon (noon–5p)</option>
            <option value="evening">Evening (5p–11p)</option>
          </select>
        </div>
        <div className="control">
          <label htmlFor="fee">Max fee ($)</label>
          <input
            id="fee"
            type="number"
            inputMode="numeric"
            placeholder="any"
            value={maxFee}
            onChange={(e) => setMaxFee(e.target.value)}
            min={0}
          />
        </div>
      </div>

      <div className="toggle-row">
        <label>
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />
          Open slots only
        </label>
        <label>
          <input
            type="checkbox"
            checked={nineOnly}
            onChange={(e) => setNineOnly(e.target.checked)}
          />
          9-hole only
        </label>
        <label>
          <input
            type="checkbox"
            checked={twosomeOnly}
            onChange={(e) => setTwosomeOnly(e.target.checked)}
          />
          Twosomes only (max 2 players)
        </label>
      </div>

      <div className={`status ${statusClass}`} style={{ marginTop: 14 }}>
        <span>
          <span className="dot" />
          {statusText}
        </span>
        {data?.fetchErrors && data.fetchErrors.length > 0 && (
          <span title={data.fetchErrors.join("\n")}>
            ⚠ {data.fetchErrors.length} course/date fetch failures
          </span>
        )}
      </div>

      {grouped.length === 0 && !loading && !error && (
        <div className="empty">
          No tee times match those filters. Try widening the date range or removing the fee cap.
        </div>
      )}

      {grouped.map(([date, slots]) => {
        const d = new Date(date + "T12:00:00");
        const dateLabel = d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        return (
          <section key={date} style={{ marginTop: 22 }}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-faint)",
                margin: "0 0 8px",
              }}
            >
              {dateLabel}
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Course</th>
                  <th style={{ textAlign: "right" }}>Fee</th>
                  <th style={{ textAlign: "right" }}>Open</th>
                  <th style={{ textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {slots.map((t, i) => (
                  <tr key={`${date}-${t.courseId}-${t.startUtc}-${i}`}>
                    <td className="time">
                      {t.startLabel.replace(/^[A-Za-z]+\s/, "")}
                      {t.holes === 9 && <span className="badge nine">9</span>}
                    </td>
                    <td>{t.courseName}</td>
                    <td className="fee">{feeLabel(t.feeCents)}</td>
                    <td className="open">
                      {t.isOpen ? (
                        <>
                          <span className="badge">{t.openSlots}/{t.maxPlayers}</span>
                        </>
                      ) : (
                        <span className="badge closed">full</span>
                      )}
                    </td>
                    <td className="book">
                      <a
                        className={`book-btn ${t.isOpen ? "" : "disabled"}`}
                        href={t.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Book →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <footer>
        Data via TeeItUp/Kenna · cached 60s ·{" "}
        <a href="https://github.com/anthropics/skills" rel="noopener">
          source
        </a>
      </footer>
    </main>
  );
}
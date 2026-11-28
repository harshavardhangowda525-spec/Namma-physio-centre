"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { ArrowLeft, ArrowRight, ExternalLink, Info, Pause, Play, Search } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Review, ReviewHighlight } from "@/content/reviews";
import { GoogleG, Stars, buttonClass } from "./ui";

const AUTO_ADVANCE_MS = 6000; // 6 seconds per transition (5–7s target window)

export function RatingSummary({
  rating,
  total,
  mapsUrl,
  compact = false,
}: {
  rating: number;
  total: number;
  mapsUrl: string;
  compact?: boolean;
}) {
  return (
    <div className={`card flex flex-wrap items-center gap-5 ${compact ? "p-5" : "p-7"}`}>
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-[var(--shadow-soft)] ring-1 ring-line">
          <GoogleG size={28} />
        </span>
        <div>
          <p className="font-display text-4xl font-medium text-navy-900">
            {rating.toFixed(1)}
            <span className="text-lg text-muted">/5</span>
          </p>
          <Stars rating={rating} size={18} />
        </div>
      </div>
      <div className="min-w-40 flex-1">
        <p className="font-semibold text-navy-900">{total.toLocaleString("en-IN")} reviews on Google</p>
        <p className="text-sm text-muted">Authentic patient rating and review count from our Google Business Profile.</p>
      </div>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
        Read all reviews on Google <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </div>
  );
}

function formatDate(r: Review) {
  if (r.relativeDate) return r.relativeDate;
  if (!r.date) return null;
  const d = new Date(r.date);
  return isNaN(+d) ? r.date : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ReviewCard({ review, clamp = true }: { review: Review; clamp?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = review.text.length > 260;
  return (
    <article className="card flex h-full min-h-[260px] flex-col p-6">
      <div className="flex items-center gap-3">
        {review.authorPhoto ? (
          <Image src={review.authorPhoto} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" unoptimized />
        ) : (
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-cyan-soft font-semibold text-teal-700"
          >
            {review.author.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-navy-900">
            {review.authorUrl ? (
              <a href={review.authorUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {review.author}
              </a>
            ) : (
              review.author
            )}
          </p>
          {formatDate(review) && <p className="text-xs text-muted">{formatDate(review)}</p>}
        </div>
        <GoogleG size={18} />
      </div>
      <Stars rating={review.rating} className="mt-4" />
      <p
        className={`mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink/85 ${
          clamp && !expanded ? "line-clamp-5" : ""
        }`}
      >
        {review.text}
      </p>
      {clamp && long && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 self-start text-sm font-semibold text-teal-700 hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
      <p className="mt-auto pt-4 text-[11px] text-muted">
        {review.source === "google-places" ? "Authentic review · Google" : "Google review · authorised clinic sync"}
      </p>
    </article>
  );
}

export function HighlightCard({ h, mapsUrl }: { h: ReviewHighlight; mapsUrl: string }) {
  return (
    <article className="card flex h-full min-h-[250px] flex-col p-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-cyan-soft font-semibold text-teal-700"
        >
          {h.author.charAt(0)}
        </span>
        <div className="flex-1">
          <p className="font-semibold text-navy-900">{h.author}</p>
          <p className="text-xs text-muted">Verified Google Reviewer</p>
        </div>
        <GoogleG size={18} />
      </div>
      <Stars rating={5} className="mt-4" />
      <p className="mt-3 text-[15px] leading-relaxed text-ink/85">{h.summary}</p>
      <p className="mt-auto flex flex-wrap items-center gap-1.5 pt-4 text-[11px] text-muted">
        <Info className="h-3 w-3 shrink-0" aria-hidden /> Summary of a Google review, not a direct quote.
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-700 hover:underline">
          Read on Google
        </a>
      </p>
    </article>
  );
}

/**
 * Automatically progressing, accessible Google Reviews carousel:
 * - Auto-rotates every 6 seconds with seamless looping
 * - Pauses on hover, keyboard focus, or manual Pause toggle
 * - Respects prefers-reduced-motion
 * - Supports touch swipe, prev/next buttons, and direct slide dots
 */
export function ReviewsCarousel({
  reviews,
  highlights,
  mapsUrl,
}: {
  reviews: Review[];
  highlights: ReviewHighlight[];
  mapsUrl: string;
}) {
  const reduceMotion = useReducedMotion();
  const items = useMemo(
    () =>
      reviews.length > 0
        ? reviews.map((r) => ({ k: r.id, node: <ReviewCard review={r} /> }))
        : highlights.map((h) => ({ k: h.author, node: <HighlightCard h={h} mapsUrl={mapsUrl} /> })),
    [reviews, highlights, mapsUrl],
  );

  const [[index, dir], setState] = useState<[number, number]>([0, 1]);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const n = items.length;
  const go = useCallback(
    (d: number) => {
      if (n <= 1) return;
      setState(([i]) => [(i + d + n) % n, d]);
    },
    [n],
  );

  const goTo = useCallback(
    (target: number) => {
      if (n <= 1 || target === index) return;
      setState(([cur]) => [target, target > cur ? 1 : -1]);
    },
    [n, index],
  );

  const autoActive = n > 1 && !reduceMotion && !userPaused && !hovered && !focused;

  useEffect(() => {
    if (!autoActive) return;
    const timer = window.setInterval(() => {
      go(1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [autoActive, go]);

  if (n === 0) return null;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -55 || info.velocity.x < -380) go(1);
    else if (info.offset.x > 55 || info.velocity.x > 380) go(-1);
  };

  const visible = [0, 1, 2].slice(0, Math.min(3, n)).map((o) => items[(index + o) % n]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Patient reviews from Google"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      <div className="relative overflow-hidden py-1">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={index}
            custom={dir}
            variants={
              reduceMotion
                ? {
                    enter: { opacity: 0 },
                    center: { opacity: 1 },
                    exit: { opacity: 0 },
                  }
                : {
                    enter: (d: number) => ({ x: d >= 0 ? 72 : -72, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (d: number) => ({ x: d >= 0 ? -72 : 72, opacity: 0 }),
                  }
            }
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0.15 : 0.55, ease: [0.16, 1, 0.3, 1] }}
            drag={n > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            className="grid cursor-grab items-stretch gap-6 active:cursor-grabbing md:grid-cols-2 lg:grid-cols-3"
            aria-live={autoActive ? "off" : "polite"}
          >
            {visible.map((v, i) => (
              <div key={`${v.k}-${i}`} className={`h-full ${i === 1 ? "hidden md:block" : i === 2 ? "hidden lg:block" : ""}`}>
                {v.node}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {n > 1 ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous review"
              className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-navy-900 shadow-xs transition hover:border-teal-300 hover:text-teal-700"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-pressed={userPaused}
              aria-label={userPaused ? "Play automatic review carousel" : "Pause automatic review carousel"}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-xs font-semibold text-navy-900 shadow-xs transition hover:border-teal-300 hover:text-teal-700"
            >
              {userPaused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
              {userPaused ? "Play" : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next review"
              className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-navy-900 shadow-xs transition hover:border-teal-300 hover:text-teal-700"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>

            <div className="ml-2 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Choose review slide">
              {items.slice(0, 12).map((it, i) => (
                <button
                  key={it.k}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show review ${i + 1} of ${n}`}
                  onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all duration-400 ${
                    i === index ? "w-6 bg-teal-500" : "w-2 bg-line hover:bg-teal-300"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div />
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-navy-900 ring-1 ring-line transition hover:ring-teal-300 hover:text-teal-700"
        >
          <GoogleG size={15} /> Read all reviews on Google <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}

const PAGE = 12;

/** Search + sort + load-more grid. Handles hundreds of reviews smoothly. */
export function ReviewsBrowser({ reviews }: { reviews: Review[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "rating">("recent");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? reviews.filter((r) => r.text.toLowerCase().includes(term) || r.author.toLowerCase().includes(term))
      : reviews.slice();
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    else list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return list;
  }, [reviews, q, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search reviews</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(PAGE);
            }}
            placeholder="Search reviews, e.g. knee, shoulder, rehabilitation"
            className="field pl-11"
            type="search"
          />
        </label>
        <label>
          <span className="sr-only">Sort reviews</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as "recent" | "rating")} className="field sm:w-48">
            <option value="recent">Most recent</option>
            <option value="rating">Highest rated</option>
          </select>
        </label>
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">
        Showing {Math.min(shown, filtered.length)} of {filtered.length} synced reviews on this page
      </p>
      <motion.ul layout className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filtered.slice(0, shown).map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <ReviewCard review={r} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      {shown < filtered.length && (
        <div className="mt-10 text-center">
          <button type="button" onClick={() => setShown((s) => s + PAGE)} className={buttonClass("secondary", "md")}>
            Load more reviews
          </button>
        </div>
      )}
    </div>
  );
}

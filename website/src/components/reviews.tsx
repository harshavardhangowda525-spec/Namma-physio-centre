"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, animate, motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ExternalLink, Info, Pause, Play, Quote, Search, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Review, ReviewHighlight } from "@/content/reviews";
import { GoogleG, Stars, buttonClass } from "./ui";

/** Marquee speed in pixels per second (gentle, readable glide). */
const MARQUEE_SPEED = 38;

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

export function ReviewCard({ review, clamp = true, onOpen }: { review: Review; clamp?: boolean; onOpen?: (r: Review) => void }) {
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
      {clamp && long && onOpen && (
        <button
          type="button"
          onClick={() => onOpen(review)}
          className="mt-2 self-start text-sm font-semibold text-teal-700 hover:underline"
        >
          Read full review
        </button>
      )}
      {clamp && long && !onOpen && (
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

type SlideItem = {
  id: string;
  author: string;
  rating: number;
  dateLabel: string | null;
  text: string;
  photo?: string | null;
  url?: string | null;
  summary: boolean;
};

function toSlide(r: Review): SlideItem {
  return { id: r.id, author: r.author, rating: r.rating, dateLabel: formatDate(r), text: r.text, photo: r.authorPhoto, url: r.authorUrl, summary: false };
}

/** Full-review pop-up shared by the carousel and the reviews list. */
export function ReviewDialog({ item, mapsUrl, onClose }: { item: SlideItem | null; mapsUrl: string; onClose: () => void }) {
  return (
    <Dialog.Root open={!!item} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {item && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[70] bg-navy-950/45 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-0 z-[71] grid place-items-center p-4 outline-none"
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.target === e.currentTarget && onClose()}
              >
                <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
                  <Dialog.Close
                    aria-label="Close review"
                    className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-cream text-navy-900 transition hover:bg-sand"
                  >
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                  <div className="overflow-y-auto overscroll-contain p-7 sm:p-9">
                    <div className="flex items-center gap-3 pr-12">
                      {item.photo ? (
                        <Image src={item.photo} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" unoptimized />
                      ) : (
                        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-cyan-soft text-lg font-semibold text-teal-700">
                          {item.author.charAt(0)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <Dialog.Title className="truncate font-sans text-lg font-semibold text-navy-900">{item.author}</Dialog.Title>
                        <p className="text-sm text-muted">{item.summary ? "Google reviewer" : item.dateLabel ?? "Google review"}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center gap-2">
                      <Stars rating={item.rating} size={18} />
                      <GoogleG size={16} />
                    </div>
                    <Quote className="mt-5 h-7 w-7 text-teal-200" aria-hidden />
                    <p className="mt-2 text-[16px] leading-relaxed whitespace-pre-line text-ink/90">{item.text}</p>
                    {item.summary && (
                      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                        <Info className="h-3.5 w-3.5" aria-hidden /> Summary of a Google review, not a direct quote.
                      </p>
                    )}
                    <a
                      href={item.url || mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass("secondary", "sm", "mt-7")}
                    >
                      <GoogleG size={15} /> View on Google <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function SlideCard({ item, onOpen }: { item: SlideItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Read the full review by ${item.author}`}
      className="group card flex h-[270px] w-[290px] shrink-0 flex-col p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-[var(--shadow-lift)] sm:w-[350px]"
    >
      <span className="flex w-full items-center gap-3">
        {item.photo ? (
          <Image src={item.photo} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" unoptimized />
        ) : (
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-cyan-soft font-semibold text-teal-700">
            {item.author.charAt(0)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-navy-900">{item.author}</span>
          <span className="block text-xs text-muted">{item.summary ? "Google reviewer" : item.dateLabel ?? "Google review"}</span>
        </span>
        <GoogleG size={18} />
      </span>
      <Stars rating={item.rating} className="mt-4" />
      <span className="mt-3 line-clamp-4 text-[15px] leading-relaxed text-ink/85">{item.text}</span>
      <span className="mt-auto pt-3 text-sm font-semibold text-teal-700 group-hover:underline">Read full review</span>
    </button>
  );
}

/**
 * Self-sliding Google Reviews carousel:
 * - Glides continuously, looping seamlessly
 * - Stops on hover, touch, keyboard focus, or the Pause button
 * - Tapping a review stops the carousel and opens the full review in a pop-up
 * - Respects prefers-reduced-motion (becomes a swipeable row)
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
  const items: SlideItem[] = useMemo(
    () =>
      reviews.length > 0
        ? reviews.map(toSlide)
        : highlights.map((h) => ({ id: h.author, author: h.author, rating: 5, dateLabel: null, text: h.summary, summary: true })),
    [reviews, highlights],
  );

  // Repeat short lists so the track is always wider than the screen, then double it for a seamless loop.
  const base = useMemo(() => {
    if (items.length === 0) return [];
    const reps = Math.max(1, Math.ceil(8 / items.length));
    return Array.from({ length: reps }, () => items).flat();
  }, [items]);
  const track = useMemo(() => [...base, ...base], [base]);

  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [touching, setTouching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState<SlideItem | null>(null);
  const resumeTimer = useRef<number | undefined>(undefined);

  const paused = userPaused || hovered || touching || focused || !!open || !!reduceMotion;

  const half = () => (trackRef.current ? trackRef.current.scrollWidth / 2 : 0);
  const wrap = (v: number) => {
    const h = half();
    if (!h) return v;
    let n = v % h;
    if (n > 0) n -= h;
    return n;
  };

  useAnimationFrame((_, delta) => {
    if (paused) return;
    x.set(wrap(x.get() - (MARQUEE_SPEED * Math.min(delta, 64)) / 1000));
  });

  const step = useCallback(
    (dir: number) => {
      const card = trackRef.current?.firstElementChild as HTMLElement | null;
      const dist = card ? card.offsetWidth + 24 : 360;
      const target = x.get() - dir * dist;
      animate(x, target, { duration: 0.5, ease: [0.16, 1, 0.3, 1], onComplete: () => x.set(wrap(x.get())) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [x],
  );

  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Patient reviews from Google"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {reduceMotion ? (
        <div className="-mx-1 flex snap-x gap-6 overflow-x-auto px-1 pb-3">
          {items.map((it) => (
            <div key={it.id} className="snap-start">
              <SlideCard item={it} onOpen={() => setOpen(it)} />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="relative overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onTouchStart={() => {
            window.clearTimeout(resumeTimer.current);
            setTouching(true);
          }}
          onTouchEnd={() => {
            resumeTimer.current = window.setTimeout(() => setTouching(false), 2500);
          }}
        >
          <motion.div ref={trackRef} style={{ x }} className="flex w-max gap-6" aria-live="off">
            {track.map((it, i) => (
              <div key={`${it.id}-${i}`} aria-hidden={i >= base.length || undefined} inert={i >= base.length ? true : undefined}>
                <SlideCard item={it} onOpen={() => setOpen(it)} />
              </div>
            ))}
          </motion.div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {!reduceMotion && (
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous reviews"
              className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-navy-900 shadow-xs transition hover:border-teal-300 hover:text-teal-700"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
          )}
          {!reduceMotion && (
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-pressed={userPaused}
              aria-label={userPaused ? "Resume sliding reviews" : "Pause sliding reviews"}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-xs font-semibold text-navy-900 shadow-xs transition hover:border-teal-300 hover:text-teal-700"
            >
              {userPaused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
              {userPaused ? "Play" : "Pause"}
            </button>
          )}
          {!reduceMotion && (
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next reviews"
              className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-navy-900 shadow-xs transition hover:border-teal-300 hover:text-teal-700"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          <span className="ml-1 hidden text-xs text-muted sm:inline">Tap any review to read it in full</span>
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-navy-900 ring-1 ring-line transition hover:ring-teal-300 hover:text-teal-700"
        >
          <GoogleG size={15} /> Read all reviews on Google <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>

      <ReviewDialog item={open} mapsUrl={mapsUrl} onClose={() => setOpen(null)} />
    </div>
  );
}

const PAGE = 12;

/** Search + sort + load-more grid. Handles hundreds of reviews smoothly. */
export function ReviewsBrowser({ reviews, mapsUrl = "https://maps.google.com" }: { reviews: Review[]; mapsUrl?: string }) {
  const [open, setOpen] = useState<SlideItem | null>(null);
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
              <ReviewCard review={r} onOpen={(rv) => setOpen(toSlide(rv))} />
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
      <ReviewDialog item={open} mapsUrl={mapsUrl} onClose={() => setOpen(null)} />
    </div>
  );
}

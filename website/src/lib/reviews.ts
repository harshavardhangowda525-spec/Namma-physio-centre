import "server-only";
import { clinic } from "@/content/clinic";
import type { Review } from "@/content/reviews";
import { listImportedReviews } from "./db";

export type ReviewsPayload = {
  rating: number;
  total: number;
  mapsUrl: string;
  reviews: Review[];
  /** "live" when rating/count came from the Places API in this request. */
  summarySource: "live" | "snapshot";
  /** How many reviews Google's API exposed (max 5 for Places API). */
  apiReviewCount: number;
  importedCount: number;
};

type PlacesReview = {
  name: string;
  relativePublishTimeDescription?: string;
  rating: number;
  text?: { text: string };
  originalText?: { text: string };
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  publishTime?: string;
};

/**
 * Fetches rating, total count and the (up to 5) reviews exposed by the
 * Google Places API (New). Google's API does NOT expose every review; the
 * full set is only available on Google Maps. Content is fetched on request
 * and not stored, in line with Google Maps Platform terms.
 */
async function fetchPlaces(): Promise<{ rating: number; total: number; mapsUrl?: string; reviews: Review[] } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const id = process.env.GOOGLE_PLACE_ID;
  if (!key || !id) return null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=en`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[reviews] Places API", res.status);
      return null;
    }
    const j = (await res.json()) as { rating?: number; userRatingCount?: number; googleMapsUri?: string; reviews?: PlacesReview[] };
    return {
      rating: j.rating ?? clinic.google.rating,
      total: j.userRatingCount ?? clinic.google.reviewCount,
      mapsUrl: j.googleMapsUri,
      reviews: (j.reviews ?? [])
        .filter((r) => (r.originalText?.text ?? r.text?.text)?.trim())
        .map((r) => ({
          id: r.name,
          author: r.authorAttribution?.displayName ?? "Google user",
          authorUrl: r.authorAttribution?.uri ?? null,
          authorPhoto: r.authorAttribution?.photoUri ?? null,
          rating: r.rating,
          date: r.publishTime ?? null,
          relativeDate: r.relativePublishTimeDescription ?? null,
          text: (r.originalText?.text ?? r.text?.text ?? "").trim(),
          source: "google-places" as const,
        })),
    };
  } catch (e) {
    console.error("[reviews] Places API error", e);
    return null;
  }
}

export async function getReviews(): Promise<ReviewsPayload> {
  const [live, imported] = await Promise.all([fetchPlaces(), listImportedReviews()]);
  // De-duplicate: an imported review with the same author + text as a live one is skipped.
  const seen = new Set((live?.reviews ?? []).map((r) => `${r.author}|${r.text.slice(0, 60)}`));
  const merged = [...(live?.reviews ?? []), ...imported.filter((r) => !seen.has(`${r.author}|${r.text.slice(0, 60)}`))];
  return {
    rating: live?.rating ?? clinic.google.rating,
    total: live?.total ?? clinic.google.reviewCount,
    mapsUrl: live?.mapsUrl ?? clinic.google.mapsUrl,
    reviews: merged,
    summarySource: live ? "live" : "snapshot",
    apiReviewCount: live?.reviews.length ?? 0,
    importedCount: imported.length,
  };
}

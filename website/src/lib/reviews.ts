import "server-only";
import { clinic } from "@/content/clinic";
import type { Review } from "@/content/reviews";
import { decrypt, encrypt, oauthEncryptionConfigured } from "./crypto";
import {
  getReviewsSyncMeta,
  getToken,
  listImportedReviews,
  recordReviewsSyncFailure,
  saveSyncedGoogleReviews,
  setToken,
  type ReviewsSyncMeta,
  type SyncedReviewInput,
} from "./db";

const GBP_PROVIDER = "google-business-reviews";
const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";
const SYNC_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours (within 6–12h target)

export type ReviewsPayload = {
  rating: number;
  total: number;
  mapsUrl: string;
  reviews: Review[];
  summarySource: "gbp-live" | "places-live" | "snapshot";
  apiReviewCount: number;
  importedCount: number;
  syncMeta: ReviewsSyncMeta | null;
};

type StoredGbpCredential = {
  refreshToken: string;
  locationName?: string | null;
  connectedAt: string;
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

const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export function gbpOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      oauthEncryptionConfigured(),
  );
}

const gbpRedirectUri = () => `${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/google-reviews/callback`;

export function gbpAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: gbpRedirectUri(),
    response_type: "code",
    scope: GBP_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeGbpCode(code: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: gbpRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`GBP token exchange failed (${res.status})`);
  const j = (await res.json()) as { refresh_token?: string };
  if (!j.refresh_token) {
    throw new Error("Google did not return a refresh token. Revoke previous access and reconnect.");
  }
  const payload: StoredGbpCredential = {
    refreshToken: j.refresh_token,
    locationName: process.env.GOOGLE_GBP_LOCATION_NAME || null,
    connectedAt: new Date().toISOString(),
  };
  await setToken(GBP_PROVIDER, encrypt(JSON.stringify(payload)));
}

export async function disconnectGbpReviews(): Promise<void> {
  await setToken(GBP_PROVIDER, null);
}

export async function isGbpConnected(): Promise<boolean> {
  if (!gbpOAuthConfigured()) return false;
  return Boolean(await getToken(GBP_PROVIDER));
}

async function getGbpAccessToken(): Promise<{ accessToken: string; cred: StoredGbpCredential } | null> {
  if (!gbpOAuthConfigured()) return null;
  const blob = await getToken(GBP_PROVIDER);
  if (!blob) return null;
  const cred = JSON.parse(decrypt(blob)) as StoredGbpCredential;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: cred.refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`GBP OAuth refresh failed (${res.status})`);
  const j = (await res.json()) as { access_token: string };
  return { accessToken: j.access_token, cred };
}

async function resolveGbpLocation(accessToken: string, existing?: string | null): Promise<string> {
  if (process.env.GOOGLE_GBP_LOCATION_NAME) return process.env.GOOGLE_GBP_LOCATION_NAME;
  if (existing) return existing;

  const accRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!accRes.ok) throw new Error(`GBP accounts lookup failed (${accRes.status})`);
  const accJson = (await accRes.json()) as { accounts?: { name: string }[] };
  const accounts = accJson.accounts ?? [];
  for (const acc of accounts) {
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=name,title,storefrontAddress`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!locRes.ok) continue;
    const locJson = (await locRes.json()) as { locations?: { name: string; title?: string }[] };
    const match = (locJson.locations ?? []).find((l) =>
      /namma\s+physio/i.test(l.title ?? ""),
    ) ?? locJson.locations?.[0];
    if (match) return `${acc.name}/${match.name.replace(/^locations\//, "locations/")}`;
  }
  throw new Error("Could not locate verified Namma Physiotherapy Centre Google Business Profile location.");
}

/**
 * Synchronizes authentic reviews via Google Business Profile API (paginated, handles
 * new, edited, and deleted reviews) when authorized, or refreshes rating/count via Places API.
 */
export async function syncGoogleReviewsNow(): Promise<{
  ok: boolean;
  provider: string;
  syncedCount: number;
  error?: string;
}> {
  // 1. Try Google Business Profile OAuth API if authorized
  if (await isGbpConnected()) {
    try {
      const auth = await getGbpAccessToken();
      if (!auth) throw new Error("GBP credentials unavailable");
      const locationPath = await resolveGbpLocation(auth.accessToken, auth.cred.locationName);

      const collected: SyncedReviewInput[] = [];
      let averageRating = clinic.google.rating;
      let totalReviewCount = clinic.google.reviewCount;
      let pageToken = "";
      let pages = 0;

      do {
        const q = new URLSearchParams({ pageSize: "50" });
        if (pageToken) q.set("pageToken", pageToken);
        const revRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${locationPath}/reviews?${q}`,
          { headers: { Authorization: `Bearer ${auth.accessToken}` }, cache: "no-store" },
        );
        if (!revRes.ok) throw new Error(`GBP reviews endpoint returned ${revRes.status}`);
        const data = (await revRes.json()) as {
          reviews?: {
            reviewId: string;
            reviewer?: { displayName?: string; profilePhotoUrl?: string };
            starRating?: string;
            comment?: string;
            createTime?: string;
            updateTime?: string;
          }[];
          averageRating?: number;
          totalReviewCount?: number;
          nextPageToken?: string;
        };

        if (typeof data.averageRating === "number") averageRating = data.averageRating;
        if (typeof data.totalReviewCount === "number") totalReviewCount = data.totalReviewCount;

        for (const r of data.reviews ?? []) {
          const cleanComment = (r.comment ?? "")
            .replace(/\s*\(Translated by Google\)[\s\S]*$/i, "")
            .trim();
          if (!cleanComment) continue;
          collected.push({
            id: `gbp:${r.reviewId}`,
            author: r.reviewer?.displayName?.trim() || "Google Reviewer",
            authorPhoto: r.reviewer?.profilePhotoUrl ?? null,
            rating: STAR_MAP[r.starRating ?? "FIVE"] ?? 5,
            date: (r.updateTime ?? r.createTime)?.slice(0, 10) ?? null,
            text: cleanComment,
            syncSource: "google-gbp",
          });
        }
        pageToken = data.nextPageToken ?? "";
        pages += 1;
      } while (pageToken && pages < 25);

      await saveSyncedGoogleReviews({
        provider: "google-gbp",
        locationName: locationPath,
        rating: averageRating,
        totalReviews: totalReviewCount,
        reviews: collected,
        replaceAllFromSource: !pageToken,
      });

      return { ok: true, provider: "google-gbp", syncedCount: collected.length };
    } catch (e) {
      const msg = (e as Error).message || "GBP sync failed";
      await recordReviewsSyncFailure("google-gbp", msg);
      return { ok: false, provider: "google-gbp", syncedCount: 0, error: msg };
    }
  }

  // 2. Fallback: Verify Google Places API (New) availability & record metadata
  const places = await fetchPlaces();
  if (places) {
    await saveSyncedGoogleReviews({
      provider: "google-places",
      locationName: process.env.GOOGLE_PLACE_ID ?? null,
      rating: places.rating,
      totalReviews: places.total,
      reviews: [],
      replaceAllFromSource: false,
    });
    return { ok: true, provider: "google-places", syncedCount: places.reviews.length };
  }

  return {
    ok: false,
    provider: "none",
    syncedCount: 0,
    error: "Neither Google Business Profile OAuth nor Google Places API credentials are configured yet.",
  };
}

/**
 * Fetches live rating, total count and the (up to 5) reviews exposed by Google Places API (New).
 * Fetched per request / short cache in compliance with Google Maps Platform policies.
 */
async function fetchPlaces(): Promise<{ rating: number; total: number; mapsUrl?: string; reviews: Review[] } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const id = process.env.GOOGLE_PLACE_ID;
  if (!key || !id) return null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=en`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error("[reviews] Places API", res.status);
      return null;
    }
    const j = (await res.json()) as {
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
      reviews?: PlacesReview[];
    };
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
  const meta = await getReviewsSyncMeta();
  const gbpConnected = await isGbpConnected();

  // Trigger non-blocking background refresh if GBP is connected and cache is > 8 hours old
  if (gbpConnected) {
    const lastMs = meta?.last_synced_at ? new Date(meta.last_synced_at).getTime() : 0;
    const lastAttemptMs = meta?.last_attempt_at ? new Date(meta.last_attempt_at).getTime() : 0;
    if (Date.now() - Math.max(lastMs, lastAttemptMs) > SYNC_INTERVAL_MS) {
      void syncGoogleReviewsNow().catch((e) => console.error("[reviews] background sync error", e));
    }
  }

  const [livePlaces, stored] = await Promise.all([fetchPlaces(), listImportedReviews()]);

  // Deduplicate by review ID and normalized author + opening text
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const merged: Review[] = [];

  for (const r of [...(livePlaces?.reviews ?? []), ...stored]) {
    const fp = `${r.author.trim().toLowerCase()}|${r.text.trim().slice(0, 80).toLowerCase()}`;
    if (seenIds.has(r.id) || seenFingerprints.has(fp)) continue;
    seenIds.add(r.id);
    seenFingerprints.add(fp);
    merged.push(r);
  }

  const gbpLive = meta?.provider === "google-gbp" && meta.last_status === "ok" && meta.rating != null;
  const rating = gbpLive
    ? meta.rating!
    : livePlaces?.rating ?? meta?.rating ?? clinic.google.rating;
  const total = gbpLive
    ? meta.total_reviews ?? clinic.google.reviewCount
    : livePlaces?.total ?? meta?.total_reviews ?? clinic.google.reviewCount;

  return {
    rating,
    total,
    mapsUrl: livePlaces?.mapsUrl ?? clinic.google.mapsUrl,
    reviews: merged,
    summarySource: gbpLive ? "gbp-live" : livePlaces ? "places-live" : "snapshot",
    apiReviewCount: livePlaces?.reviews.length ?? 0,
    importedCount: stored.length,
    syncMeta: meta,
  };
}

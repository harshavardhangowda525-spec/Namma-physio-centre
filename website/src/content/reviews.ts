/**
 * Review data types and the supplied review REFERENCES.
 *
 * The references below are short summaries of truncated Google review excerpts
 * supplied by the client. They are NOT quotations and must never be rendered
 * inside quotation marks or presented as the reviewer's own words. They are
 * shown only as "review highlights" until authentic review text is available
 * from the Google Places API or an authorised import.
 */

export type Review = {
  id: string;
  author: string;
  authorPhoto?: string | null;
  authorUrl?: string | null;
  rating: number;
  /** ISO date string or Google's relative description (e.g. "2 months ago"). */
  date: string | null;
  relativeDate?: string | null;
  text: string;
  source: "google-places" | "authorised-import";
};

export type ReviewHighlight = { author: string; summary: string };

export const reviewHighlights: ReviewHighlight[] = [
  {
    author: "Shalini Kumari",
    summary: "Praised Dr. Sunil's professional, friendly approach and his clear explanations.",
  },
  {
    author: "Sagar S. Acharya",
    summary: "Wrote about rehabilitation for a meniscus tear and commented on the clinic's cleanliness.",
  },
  {
    author: "Rino Davis",
    summary: "Described Dr. Sunil Kumar's guidance during rehabilitation after a high-grade MPFL tear.",
  },
];

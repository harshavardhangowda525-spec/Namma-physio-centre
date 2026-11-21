import type { MetadataRoute } from "next";
import { siteUrl } from "@/content/clinic";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/about", "/services", "/book", "/reviews", "/contact", "/privacy", "/terms"].map((p) => ({
    url: `${siteUrl}${p}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.7,
  }));
}

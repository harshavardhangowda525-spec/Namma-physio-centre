import { clinic, siteUrl } from "@/content/clinic";
import { publicServices } from "@/content/services";

export function clinicJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["MedicalBusiness", "Physiotherapy"],
    name: clinic.name,
    url: siteUrl,
    telephone: clinic.phoneE164,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${clinic.address.line1}, ${clinic.address.line2}`,
      addressLocality: clinic.address.city,
      addressRegion: clinic.address.state,
      postalCode: clinic.address.postalCode,
      addressCountry: "IN",
    },
    geo: { "@type": "GeoCoordinates", latitude: clinic.geo.lat, longitude: clinic.geo.lng },
    hasMap: clinic.google.mapsUrl,
    areaServed: "JP Nagar, Bengaluru",
    availableService: publicServices.map((s) => ({ "@type": "MedicalTherapy", name: s.title })),
  };
}

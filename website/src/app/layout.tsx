import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FloatingContactButtons } from "@/components/floating-contact";
import { Providers } from "@/components/providers";
import { clinic, siteUrl } from "@/content/clinic";
import { clinicJsonLd } from "@/lib/jsonld";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${clinic.name} | Evidence-Based Physiotherapy & Rehabilitation in JP Nagar, Bengaluru`,
    template: `%s | ${clinic.name}`,
  },
  description:
    "Evidence-based physiotherapy and customized rehabilitation protocols at Namma Physiotherapy Centre, JP Nagar 8th Phase, Bengaluru. Over 8+ years of clinical experience in orthopedic, sports injury, post-surgical, spine, shoulder, knee, neurological and home physiotherapy.",
  keywords: [
    "physiotherapy JP Nagar",
    "Namma Physiotherapy Centre",
    "Namma Physio Centre",
    "physiotherapist Bengaluru",
    "sports injury rehabilitation Bengaluru",
    "knee rehabilitation JP Nagar",
    "post-surgical physiotherapy Bengaluru",
    "neurological rehabilitation Bengaluru",
    "IVDP physiotherapy Bengaluru",
    "home physiotherapy JP Nagar",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: clinic.name,
    url: siteUrl,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(clinicJsonLd()) }} />
        <Providers>
          <Navbar />
          <main id="main">{children}</main>
          <Footer />
          <FloatingContactButtons />
        </Providers>
      </body>
    </html>
  );
}

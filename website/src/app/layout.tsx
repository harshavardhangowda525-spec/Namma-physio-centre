import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Providers } from "@/components/providers";
import { clinic, siteUrl } from "@/content/clinic";
import { clinicJsonLd } from "@/lib/jsonld";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${clinic.name} | Physiotherapy & Rehabilitation in JP Nagar, Bengaluru`,
    template: `%s | ${clinic.name}`,
  },
  description:
    "Personalised physiotherapy and rehabilitation at Namma Physio Centre, JP Nagar 8th Phase, Bengaluru. Knee, post-surgical and home-visit physiotherapy. Request an appointment online.",
  keywords: ["physiotherapy JP Nagar", "physiotherapist Bengaluru", "knee rehabilitation", "home physiotherapy Bengaluru", "Namma Physio Centre"],
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
        </Providers>
      </body>
    </html>
  );
}

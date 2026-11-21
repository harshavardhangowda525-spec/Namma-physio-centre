import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clinic admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-cream pt-28 pb-20">{children}</div>;
}

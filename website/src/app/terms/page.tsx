import type { Metadata } from "next";
import { clinic } from "@/content/clinic";

export const metadata: Metadata = { title: "Terms of Use", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <article className="container-px max-w-3xl pt-36 pb-10 [&_h2]:mt-10 [&_h2]:text-2xl [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-muted">
      <p className="eyebrow !mt-0">Draft — requires legal review</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">Terms of Use</h1>
      <h2>General information only</h2>
      <p>Content on this website is general information about physiotherapy and is not medical advice. It does not replace an individual assessment by a qualified professional. Recovery and outcomes vary between individuals and are not guaranteed.</p>
      <h2>Appointment requests</h2>
      <p>Submitting the booking form sends a request with your preferred date and time. It is not a confirmed appointment. {clinic.name} will contact you to confirm, suggest another time, or decline. Home visits depend on location and availability.</p>
      <h2>Emergencies</h2>
      <p>This website is not for emergencies. If you need urgent medical help, call 112 or go to the nearest hospital.</p>
      <h2>Reviews</h2>
      <p>Reviews shown on this website come from Google and belong to their authors. We do not edit review content.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: {clinic.phoneDisplay}.</p>
    </article>
  );
}

import type { Metadata } from "next";
import { clinic } from "@/content/clinic";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <article className="container-px max-w-3xl pt-36 pb-10 [&_h2]:mt-10 [&_h2]:text-2xl [&_li]:mt-2 [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-muted [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted">
      <p className="eyebrow !mt-0">Draft — requires legal review</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">Privacy Policy</h1>
      <p>This policy explains how {clinic.name} (&quot;we&quot;) handles personal data submitted through this website, in line with India&apos;s Digital Personal Data Protection Act, 2023 and other applicable law.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Appointment request details you provide: name, mobile number, optional email, preferred date and time, optional reason and notes, and for home visits your address, locality and PIN code.</li>
        <li>The time you gave consent to be contacted.</li>
        <li>Basic technical information needed to keep the site secure (for example, IP address for rate-limiting). We do not use advertising trackers.</li>
      </ul>
      <h2>Why we collect it</h2>
      <p>Only to respond to your appointment request, contact you to confirm, reschedule or decline it, and to plan home visits.</p>
      <h2>Health information</h2>
      <p>Please share only what is needed to arrange your appointment. Detailed medical history is discussed in person. Calendar entries created for appointments do not include medical details.</p>
      <h2>Who can see it</h2>
      <p>Only authorised clinic staff. Data is stored with our hosting and database providers, and email notifications are delivered by our email provider, all acting on our instructions. We never sell your data.</p>
      <h2>How long we keep it</h2>
      <p>Website appointment requests are kept for up to 12 months and then deleted, unless a longer period is required by law. Clinical and billing records are kept separately at the clinic.</p>
      <h2>Your rights</h2>
      <p>You can ask to access, correct or delete your data, or withdraw consent, by calling {clinic.phoneDisplay}. You may also raise a grievance with the Data Protection Board of India.</p>
      <h2>Changes</h2>
      <p>We may update this policy. The latest version will always be on this page.</p>
    </article>
  );
}

import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="container-px grid min-h-[70vh] place-items-center pt-32 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="mt-6 text-5xl">This page has moved on</h1>
        <p className="lead mt-4">The page you are looking for doesn&apos;t exist.</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/book" variant="secondary">Book an appointment</ButtonLink>
        </div>
      </div>
    </section>
  );
}

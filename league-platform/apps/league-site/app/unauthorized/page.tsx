import Link from "next/link";
import { SiteShell } from "../components/site-shell";

export default function UnauthorizedPage() {
  return (
    <SiteShell title="Unauthorized" subtitle="Your Discord account is not mapped to a Founder or Staff role yet.">
      <section className="card flex flex-col gap-3">
        <p className="text-sm text-muted">
          Ask a founder to assign your Discord role, then sign in again.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="inline-flex w-fit rounded-md border border-primary bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-strong"
          >
            Back to login
          </Link>
          <Link href="/" className="inline-flex w-fit rounded-md border border-border px-4 py-2 font-semibold hover:bg-surface-2">
            Go home
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}


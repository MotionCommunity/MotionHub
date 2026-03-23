import Link from "next/link";
import { SiteShell } from "../components/site-shell";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string; loggedOut?: string }>;
};

const errorMap: Record<string, string> = {
  missing_code: "Discord did not return an authorization code.",
  invalid_state: "Login session expired. Please try again.",
  token_exchange_failed: "Failed to exchange Discord token.",
  missing_access_token: "Discord token response was invalid.",
  user_fetch_failed: "Failed to load your Discord profile.",
  callback_failed: "Unexpected login error.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/admin";
  const errorText = sp.error ? errorMap[sp.error] || "Login failed." : "";

  return (
    <SiteShell title="Staff Login" subtitle="Sign in with Discord to access Motion Community admin tools.">
      <section className="card flex flex-col gap-4">
        {sp.loggedOut ? <p className="text-sm text-muted">You have been logged out.</p> : null}
        {errorText ? <p className="text-sm text-red-300">{errorText}</p> : null}
        <Link
          href={`/api/auth/login?next=${encodeURIComponent(next)}`}
          className="inline-flex w-fit rounded-md border border-primary bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-strong"
        >
          Continue with Discord
        </Link>
      </section>
    </SiteShell>
  );
}


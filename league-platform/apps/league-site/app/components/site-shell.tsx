import Link from "next/link";
import type { ReactNode } from "react";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/stats", label: "Stats" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/register", label: "Register" },
  { href: "/partners", label: "Partners" },
  { href: "/handbook", label: "Handbook" },
  { href: "/bracket", label: "Bracket" },
];

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/bot", label: "Bot" },
];

type SiteShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function SiteShell({ title, subtitle, children }: SiteShellProps) {
  const isAdminPage = title.startsWith("Admin");

  return (
    <div className="page-shell">
      <header className="border-b border-border/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-3xl font-bold text-primary">
              MOTION COMMUNITY
            </Link>
            <Link
              href="/admin"
              className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-strong"
            >
              Staff Portal
            </Link>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            {publicLinks.map((link) => (
              <Link key={link.href} href={link.href} className="chip hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
          {isAdminPage ? (
            <nav className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2 text-sm">
              <span className="text-xs uppercase tracking-wide text-muted">Admin Quick Nav</span>
              {adminLinks.map((link) => (
                <Link key={link.href} href={link.href} className="chip hover:text-foreground">
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8">
        <section className="card">
          <h1 className="text-4xl font-bold">{title}</h1>
          {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
        </section>
        {children}
      </main>

      <footer className="mx-auto mt-8 flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-6 text-sm text-muted">
        <span>motioncommunity.gg</span>
        <nav className="flex flex-wrap gap-2">
          {adminLinks.map((link) => (
            <Link key={link.href} href={link.href} className="chip hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}


import { SiteShell } from "./components/site-shell";

export default function Home() {
  return (
    <SiteShell
      title="Rocket League Esports Platform"
      subtitle="Professional one-stop hub for Motion Community players, staff, partners, and tournaments."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <article className="card">
          <h2 className="text-2xl font-semibold">Latest Results</h2>
          <p className="mt-2 text-sm text-muted">
            Hook this card to tournament/match results from the league API in phase 2.
          </p>
        </article>
        <article className="card">
          <h2 className="text-2xl font-semibold">Live Bracket</h2>
          <p className="mt-2 text-sm text-muted">
            Dedicated bracket page is scaffolded and ready for live updates.
          </p>
        </article>
        <article className="card">
          <h2 className="text-2xl font-semibold">Player Stats</h2>
          <p className="mt-2 text-sm text-muted">
            Stats + leaderboard page is ready and will read from PostgreSQL via API.
          </p>
        </article>
      </section>
    </SiteShell>
  );
}

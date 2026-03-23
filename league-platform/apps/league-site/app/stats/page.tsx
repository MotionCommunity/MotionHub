import { PlaceholderGrid } from "../components/placeholder-grid";
import { SiteShell } from "../components/site-shell";

export default function StatsPage() {
  return (
    <SiteShell
      title="Player Stats and Leaderboard"
      subtitle="Connected to PostgreSQL via league API. Ready for ranked tables, filters, and player profiles."
    >
      <PlaceholderGrid
        items={[
          { title: "Leaderboard", text: "Global leaderboard with rank, wins/losses, and advanced replay metrics." },
          { title: "Player Search", text: "Search by username, Discord ID, or team, with quick stat snapshots." },
          { title: "Match History", text: "Recent matches and per-game stat breakdowns pulled from parsed replays." },
        ]}
      />
    </SiteShell>
  );
}


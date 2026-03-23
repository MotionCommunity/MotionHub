import { PlaceholderGrid } from "../components/placeholder-grid";
import { SiteShell } from "../components/site-shell";

export default function TournamentsPage() {
  return (
    <SiteShell
      title="Tournaments"
      subtitle="Track current and past tournaments, rounds, results, and bracket progress from one place."
    >
      <PlaceholderGrid
        items={[
          { title: "Current Events", text: "Show active tournaments with status, start time, and round stage." },
          { title: "Past Results", text: "Archive of completed events with champions, placements, and VOD links." },
          { title: "Bracket Links", text: "Direct links to live bracket viewer and match operations pages." },
        ]}
      />
    </SiteShell>
  );
}


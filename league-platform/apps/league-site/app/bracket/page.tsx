import { PlaceholderGrid } from "../components/placeholder-grid";
import { SiteShell } from "../components/site-shell";

export default function BracketPage() {
  return (
    <SiteShell
      title="Live Bracket"
      subtitle="Live bracket viewer page for automatic round updates and result snapshots."
    >
      <PlaceholderGrid
        items={[
          { title: "Bracket Canvas", text: "Dedicated bracket renderer area with auto-refresh and round filters." },
          { title: "Round Feed", text: "Compact timeline of round updates posted by staff/bot workflows." },
          { title: "Match Status", text: "At-a-glance pending/live/completed badges for each scheduled match." },
        ]}
      />
    </SiteShell>
  );
}


import { PlaceholderGrid } from "../../components/placeholder-grid";
import { SiteShell } from "../../components/site-shell";

export default function AdminSchedulePage() {
  return (
    <SiteShell
      title="Admin / Schedule"
      subtitle="Manage stream and match schedules with partner-owned editing lanes."
    >
      <PlaceholderGrid
        items={[
          { title: "Weekly Planner", text: "Day-by-day schedule grid for partner stream slots and event timing." },
          { title: "Partner Edits", text: "Role-scoped editing so partners can manage only their own schedule blocks." },
          { title: "Discord Sync", text: "Manual trigger + automatic weekly post to announcements channel." },
        ]}
      />
    </SiteShell>
  );
}


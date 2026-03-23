import { PlaceholderGrid } from "../components/placeholder-grid";
import { SiteShell } from "../components/site-shell";

export default function HandbookPage() {
  return (
    <SiteShell
      title="Handbook"
      subtitle="Centralized staff, partner, and tournament guidelines with sidebar-friendly sectioning."
    >
      <PlaceholderGrid
        items={[
          { title: "Staff Guidelines", text: "Operational expectations, moderation standards, and escalation flow." },
          { title: "Partner Guidelines", text: "Brand, schedule, and communication standards for partners." },
          { title: "Tournament Rules", text: "Ruleset, dispute handling, reporting instructions, and role hierarchy." },
        ]}
      />
    </SiteShell>
  );
}


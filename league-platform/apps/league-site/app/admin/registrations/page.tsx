import { PlaceholderGrid } from "../../components/placeholder-grid";
import { SiteShell } from "../../components/site-shell";

export default function AdminRegistrationsPage() {
  return (
    <SiteShell
      title="Admin / Registrations"
      subtitle="Review pending form responses and approve/reject with one click."
    >
      <PlaceholderGrid
        items={[
          { title: "Pending Queue", text: "Unified queue for player, mod, and partner submissions from Sheets/API sync." },
          { title: "Decision Actions", text: "Approve/reject controls with notes and reviewer timestamp logging." },
          { title: "Automation Hooks", text: "Approval events can trigger Discord role assignment and onboarding messages." },
        ]}
      />
    </SiteShell>
  );
}


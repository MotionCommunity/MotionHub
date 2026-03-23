import { PlaceholderGrid } from "../components/placeholder-grid";
import { SiteShell } from "../components/site-shell";

export default function RegisterPage() {
  return (
    <SiteShell
      title="Tournament Registration"
      subtitle="Use Google Forms bridge now, then upgrade to native website forms with direct API writes."
    >
      <PlaceholderGrid
        items={[
          { title: "Player Registration", text: "Current flow can embed your Google Form while DB sync runs in background." },
          { title: "Status Tracking", text: "Registrations enter pending queue for staff approve/reject workflow." },
          { title: "Verification", text: "Approved players can trigger Discord role assignment through bot automation." },
        ]}
      />
    </SiteShell>
  );
}


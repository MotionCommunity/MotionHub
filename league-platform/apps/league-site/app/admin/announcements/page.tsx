import { PlaceholderGrid } from "../../components/placeholder-grid";
import { SiteShell } from "../../components/site-shell";

export default function AdminAnnouncementsPage() {
  return (
    <SiteShell
      title="Admin / Announcements"
      subtitle="Compose, schedule, and post announcements to Discord channels."
    >
      <PlaceholderGrid
        items={[
          { title: "Composer", text: "Rich text editor with channel targeting and preview support." },
          { title: "Scheduling Queue", text: "Schedule future announcement posts and track sent status." },
          { title: "Discord Delivery", text: "One-click publish and bot-backed posting to configured channels." },
        ]}
      />
    </SiteShell>
  );
}


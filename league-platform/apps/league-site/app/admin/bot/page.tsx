import { PlaceholderGrid } from "../../components/placeholder-grid";
import { SiteShell } from "../../components/site-shell";

export default function AdminBotPage() {
  return (
    <SiteShell
      title="Admin / Bot Controls"
      subtitle="Control Discord automation for match channels, pings, brackets, and announcements."
    >
      <PlaceholderGrid
        items={[
          { title: "Match Channels", text: "Trigger channel creation/closure workflows and inspect active match rooms." },
          { title: "Bracket + Ping Actions", text: "Post bracket updates and ping teams when matches are ready." },
          { title: "Bot Jobs", text: "Manual run controls for schedule posts, retries, and queued announcements." },
        ]}
      />
    </SiteShell>
  );
}


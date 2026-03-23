import { PlaceholderGrid } from "../components/placeholder-grid";
import { SiteShell } from "../components/site-shell";

export default function PartnersPage() {
  return (
    <SiteShell
      title="Partners"
      subtitle="Professional partner cards with social links, schedule highlights, and collaboration details."
    >
      <PlaceholderGrid
        items={[
          { title: "Partner Cards", text: "Card layout with branding assets, role, platforms, and social profiles." },
          { title: "Stream Highlights", text: "Weekly schedule snippets and featured stream slots." },
          { title: "Partner Profiles", text: "Dedicated profile pages for long-form bios and contact channels." },
        ]}
      />
    </SiteShell>
  );
}


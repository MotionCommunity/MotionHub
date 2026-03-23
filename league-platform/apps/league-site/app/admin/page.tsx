import { PlaceholderGrid } from "../components/placeholder-grid";
import { SiteShell } from "../components/site-shell";

export default function AdminDashboardPage() {
  return (
    <SiteShell
      title="Admin Dashboard"
      subtitle="Staff portal overview: players, tournaments, schedules, announcements, and bot operations."
    >
      <PlaceholderGrid
        items={[
          { title: "Operational Overview", text: "Pending registrations, live matches, and upcoming schedule in one snapshot." },
          { title: "Quick Actions", text: "One-click links to approvals, round advance, and announcement posting." },
          { title: "System Health", text: "API, parser worker, and bot state indicators for staff confidence." },
        ]}
      />
    </SiteShell>
  );
}


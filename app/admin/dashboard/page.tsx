import { Clapperboard, Users, Eye, Tv } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";

// Mock overview numbers — stands in for a real "GET /admin/stats" response.
const stats = [
  { label: "Total Titles", value: "312", Icon: Clapperboard },
  { label: "Total Users", value: "48,204", Icon: Users },
  { label: "Views This Week", value: "6.2M", Icon: Eye },
  { label: "Active Channels", value: "4", Icon: Tv },
];

export default function AdminDashboardPage() {
  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <h1 className="font-display font-bold text-2xl mb-1">Dashboard</h1>
        <p className="text-sm text-text-muted mb-8">
          Overview of DramaShort's current activity.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="bg-surface border border-border rounded-lg shadow-sm p-5"
            >
              <div className="flex items-center gap-2 text-text-muted mb-3">
                <Icon size={16} strokeWidth={2} />
                <span className="text-xs font-semibold">{label}</span>
              </div>
              <p className="font-display font-bold text-2xl">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-surface border border-border rounded-lg shadow-sm p-8 text-center">
          <p className="text-sm text-text-muted">
            Title management, channel management, and the other sections in the
            sidebar aren't built yet — this is just the entry point into the admin area.
          </p>
        </div>
      </main>
    </div>
  );
}

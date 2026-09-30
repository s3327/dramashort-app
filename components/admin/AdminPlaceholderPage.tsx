import type { LucideIcon } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminPlaceholderPage({
  title,
  description,
  Icon,
}: {
  title: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <h1 className="font-display font-bold text-2xl mb-1">{title}</h1>
        <p className="text-sm text-text-muted mb-8">{description}</p>

        <div className="bg-surface border border-border rounded-lg shadow-sm p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon size={22} strokeWidth={2} />
          </div>
          <p className="text-sm text-text-muted max-w-sm mx-auto">
            This section isn&apos;t built yet — {title.toLowerCase()} management will
            live here once we get to it.
          </p>
        </div>
      </main>
    </div>
  );
}

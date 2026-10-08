import Link from "next/link";
import { Eye } from "lucide-react";

export default function PreviewModeBanner({
  status = "Draft",
  dramaId,
}: {
  status?: string;
  dramaId?: string;
}) {
  return (
    <aside
      aria-label="Preview Mode Banner"
      className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-4 py-2 text-xs font-medium shadow-md flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-2">
        <Eye size={16} className="shrink-0" />
        <span>
          <strong>Preview Mode ({status}):</strong> You are viewing an unpublished title as an administrator.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {dramaId && (
          <Link
            href={`/admin/dramas/${dramaId}/edit`}
            className="underline font-semibold hover:text-slate-900 transition-colors"
          >
            Edit in Admin
          </Link>
        )}
        <Link
          href="/admin/dramas"
          className="rounded bg-slate-950 text-white px-2 py-0.5 text-[11px] font-semibold hover:bg-slate-800 transition-colors"
        >
          Exit Preview
        </Link>
      </div>
    </aside>
  );
}

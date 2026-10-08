import type { ReactNode } from "react";

export default function Toast({
  message,
  icon,
}: {
  message: string | null;
  icon?: ReactNode;
}) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-text text-text-inverse text-sm font-semibold px-4 py-2.5 shadow-lg animate-riseIn"
    >
      {icon}
      {message}
    </div>
  );
}

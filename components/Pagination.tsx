"use client";

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className = "mt-10",
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-full border border-border text-sm font-semibold text-text hover:bg-surface disabled:opacity-30 disabled:pointer-events-none transition-colors px-4 py-2 mr-2"
      >
        Previous
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          aria-current={p === page}
          className={`h-8 w-8 rounded-full text-sm font-semibold transition-colors ${
            p === page
              ? "bg-btn-primary text-btn-primary-text"
              : "text-text-muted hover:text-text hover:bg-surface"
          }`}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded-full border border-border text-sm font-semibold text-text hover:bg-surface disabled:opacity-30 disabled:pointer-events-none transition-colors px-4 py-2 ml-2"
      >
        Next
      </button>
    </div>
  );
}

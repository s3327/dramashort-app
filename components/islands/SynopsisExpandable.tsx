"use client";

import { useState } from "react";

export interface SynopsisExpandableProps {
  synopsis: string;
  truncateLength?: number;
  className?: string;
}

const DEFAULT_TRUNCATE_LENGTH = 220;

/**
 * Client island for synopsis rendering: keeps full text in server HTML document
 * for crawler indexing while offering interactive expand/collapse toggle.
 */
export default function SynopsisExpandable({
  synopsis,
  truncateLength = DEFAULT_TRUNCATE_LENGTH,
  className = "mb-6 max-w-2xl",
}: SynopsisExpandableProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongSynopsis = (synopsis || "").length > truncateLength;

  if (!synopsis) {
    return null;
  }

  return (
    <div className={className}>
      <p
        className={`text-sm leading-relaxed text-text-muted ${
          isLongSynopsis && !isExpanded ? "line-clamp-4" : ""
        }`}
      >
        {synopsis}
      </p>
      {isLongSynopsis && (
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="mt-1.5 text-sm font-semibold text-link hover:text-link-hover transition-colors"
        >
          {isExpanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export { SynopsisExpandable };

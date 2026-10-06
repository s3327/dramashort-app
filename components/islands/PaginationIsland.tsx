"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Pagination from "@/components/Pagination";

export interface PaginationIslandProps {
  page: number;
  totalPages: number;
  basePath?: string;
  className?: string;
}

/**
 * Unified client pagination controls that preserve existing query parameter
 * semantics (?page=, ?genre=, etc.) and perform smooth window scrolling.
 */
export default function PaginationIsland({
  page,
  totalPages,
  basePath,
  className,
}: PaginationIslandProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) {
    return null;
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (newPage > 1) {
      params.set("page", String(newPage));
    } else {
      params.delete("page");
    }

    const path = basePath || (typeof window !== "undefined" ? window.location.pathname : "");
    const queryString = params.toString();
    const newUrl = queryString ? `${path}?${queryString}` : path;

    router.push(newUrl);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      onPageChange={handlePageChange}
      className={className}
    />
  );
}

export { PaginationIsland };

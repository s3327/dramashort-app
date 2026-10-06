import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard from "@/components/TitleCard";
import PageShell from "@/components/PageShell";
import PaginationIsland from "@/components/islands/PaginationIsland";
import { searchPublishedTitles } from "@/lib/services/content.service";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "New Releases — DramaShort",
  description:
    "Discover the newest short-form vertical drama releases and episodes on DramaShort.",
};

const PAGE_SIZE = 24;

/**
 * Server Component pre-rendering new releases with server-side pagination.
 */
export default async function NewReleasePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const rawPage = typeof sp?.page === "string" ? sp.page : Array.isArray(sp?.page) ? sp.page[0] : undefined;
  const page = Math.max(1, parseInt(rawPage || "1", 10) || 1);

  const results = await searchPublishedTitles({
    sort: "newest",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <PageShell className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16">
        <h1 className="font-display font-bold text-2xl mb-8">New Release</h1>

        {results.items.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-12 text-center my-6 max-w-lg mx-auto shadow-sm">
            <h2 className="font-display font-bold text-lg mb-2">No new releases yet</h2>
            <p className="text-sm text-text-muted">
              Check back soon for new drama series releases.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {results.items.map((item) => (
                <TitleCard
                  key={item.id}
                  href={`/drama/${item.slug}`}
                  poster={item.poster}
                  title={item.title}
                />
              ))}
            </div>

            <Suspense fallback={null}>
              <PaginationIsland
                page={results.page}
                totalPages={results.totalPages}
                basePath="/new-release"
              />
            </Suspense>
          </>
        )}
      </main>

      <Footer />
    </PageShell>
  );
}

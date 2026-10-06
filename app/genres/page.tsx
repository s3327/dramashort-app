import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard from "@/components/TitleCard";
import PageShell from "@/components/PageShell";
import GenreFilterIsland from "@/components/islands/GenreFilterIsland";
import PaginationIsland from "@/components/islands/PaginationIsland";
import {
  searchPublishedTitles,
  getDistinctGenres,
} from "@/lib/services/content.service";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Genres — DramaShort",
  description:
    "Explore short-form vertical dramas by genre — romance, revenge, thriller, fantasy, and more.",
};

const PAGE_SIZE = 24;
const ALL_GENRE = "All";

/**
 * Server Component pre-rendering genre taxonomies and filtered catalog items.
 */
export default async function GenresPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const genreParam = typeof sp?.genre === "string" ? sp.genre : Array.isArray(sp?.genre) ? sp.genre[0] : undefined;
  const rawPage = typeof sp?.page === "string" ? sp.page : Array.isArray(sp?.page) ? sp.page[0] : undefined;
  const page = Math.max(1, parseInt(rawPage || "1", 10) || 1);

  const distinctGenres = await getDistinctGenres();
  const matchedGenre =
    genreParam && genreParam.toLowerCase() !== ALL_GENRE.toLowerCase()
      ? distinctGenres.find((g) => g.toLowerCase() === genreParam.toLowerCase()) || genreParam
      : ALL_GENRE;

  const results = await searchPublishedTitles({
    genre: matchedGenre !== ALL_GENRE ? matchedGenre : undefined,
    page,
    pageSize: PAGE_SIZE,
    sort: "trending",
  });

  const allGenres = [ALL_GENRE, ...distinctGenres.filter((g) => g.toLowerCase() !== ALL_GENRE.toLowerCase())];

  return (
    <PageShell className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16">
        <h1 className="font-display font-bold text-2xl mb-5">Genres</h1>

        <Suspense fallback={null}>
          <GenreFilterIsland genres={allGenres} activeGenre={matchedGenre} />
        </Suspense>

        {results.items.length === 0 ? (
          <p className="text-sm text-text-muted py-12 text-center">
            No titles found in this genre yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6 mt-8">
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
                basePath="/genres"
              />
            </Suspense>
          </>
        )}
      </main>

      <Footer />
    </PageShell>
  );
}

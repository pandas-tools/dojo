import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyPreviewToken } from "@/lib/preview-tokens";
import { loadPreviewBrowse } from "@/lib/preview-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preview · Dojo" };

export default async function PreviewBrowsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = verifyPreviewToken(token);
  if (!payload) notFound();
  const data = await loadPreviewBrowse(payload.clientId);
  if (!data) notFound();

  const { header, lessons } = data;

  return (
    <main className="min-h-screen bg-zinc-50">
      <PreviewBanner clientName={header.clientName} />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <h1 className="text-lg font-semibold">Dojo</h1>
          <p className="text-xs text-zinc-500">
            {header.clientName} · Previewing as employee
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-xl font-semibold mb-2">Training lessons</h2>
        <p className="text-sm text-zinc-600 mb-8">
          {lessons.length === 0
            ? "No lessons assigned to this client yet."
            : `${lessons.length} lesson${lessons.length === 1 ? "" : "s"}`}
        </p>

        {lessons.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((card) => (
              <Link
                key={card.lessonId}
                href={`/preview/${token}/watch/${card.lessonId}`}
                className="group block overflow-hidden rounded-md border border-zinc-200 bg-white hover:shadow-md transition-shadow"
              >
                <div className="aspect-video bg-zinc-100 relative">
                  {card.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={card.thumbnailUrl}
                      alt={card.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                      No preview
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-zinc-900 group-hover:text-zinc-700">
                    {card.title}
                  </h3>
                  {card.description && (
                    <p className="mt-1 text-sm text-zinc-600 line-clamp-2">
                      {card.description}
                    </p>
                  )}
                  <div className="mt-2 text-[11px] uppercase tracking-wide text-zinc-400">
                    {card.contentType}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PreviewBanner({ clientName }: { clientName: string }) {
  return (
    <div className="bg-amber-100 text-amber-900 text-xs px-4 py-2 text-center">
      <span className="font-medium">Preview mode</span> · viewing as a{" "}
      {clientName} employee · ratings and analytics are disabled
    </div>
  );
}

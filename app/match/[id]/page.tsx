import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut } from '@phosphor-icons/react/dist/ssr';
import { PanelCard } from '@/components/panel-card';
import { Card, CardContent } from '@/components/ui/card';
import { getMatchById } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMatchById(id);
  if (!data) notFound();

  const sourceUrl = data.panels.find((p) => p.sourceUrl)?.sourceUrl ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        href="/today"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft weight="bold" className="size-4" />
        Back to today
      </Link>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.homeTeam} <span className="text-muted-foreground">vs</span>{' '}
          {data.awayTeam}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{data.date}</span>
        </p>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View original post
            <ArrowSquareOut weight="bold" className="size-3.5" />
          </a>
        ) : null}
      </header>

      {data.panels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No panels uploaded for this match yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {data.panels.map((p) => (
            <PanelCard key={p.id} panel={p} />
          ))}
        </div>
      )}
    </main>
  );
}

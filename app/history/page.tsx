import Link from 'next/link';
import { Star } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getRecentMatches, type MatchWithPanels } from '@/lib/queries';
import { isFavorite } from '@/lib/favorites';

export const dynamic = 'force-dynamic';

function groupByDate(matches: MatchWithPanels[]): Map<string, MatchWithPanels[]> {
  const map = new Map<string, MatchWithPanels[]>();
  for (const m of matches) {
    const list = map.get(m.date) ?? [];
    list.push(m);
    map.set(m.date, list);
  }
  return map;
}

export default async function HistoryPage() {
  const matches = await getRecentMatches(50);
  const grouped = groupByDate(matches);

  if (matches.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="mb-5 text-xl font-semibold tracking-tight">History</h1>
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <p>No panels uploaded yet.</p>
            <Link
              href="/upload"
              className="mt-3 inline-block text-sm font-medium text-foreground hover:underline"
            >
              Upload one now
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold tracking-tight">History</h1>
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([date, dayMatches]) => (
          <section key={date}>
            <h2 className="mb-2 font-mono text-xs tabular-nums text-muted-foreground">
              {date}
            </h2>
            <div className="space-y-3">
              {dayMatches.map((m) => {
                const favHits = m.panels.flatMap((p) =>
                  p.entries.filter((e) => isFavorite(e.nameAsShown))
                );
                return (
                  <Link
                    key={m.id}
                    href={`/match/${m.id}`}
                    className="block"
                  >
                    <Card className="transition-colors hover:bg-muted/30">
                      <CardContent className="flex items-center justify-between gap-3 py-4">
                        <div>
                          <p className="font-medium">
                            {m.homeTeam}{' '}
                            <span className="text-muted-foreground">vs</span>{' '}
                            {m.awayTeam}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            <span className="font-mono tabular-nums">
                              {m.panels.length}
                            </span>{' '}
                            {m.panels.length === 1 ? 'panel' : 'panels'}
                          </p>
                        </div>
                        {favHits.length > 0 ? (
                          <Badge variant="secondary" className="gap-1">
                            <Star
                              weight="fill"
                              className="size-3 text-amber-500"
                            />
                            <span className="font-mono tabular-nums">
                              {favHits.length}
                            </span>
                          </Badge>
                        ) : null}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

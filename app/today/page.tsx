import Link from 'next/link';
import { CalendarBlank, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent } from '@/components/ui/card';
import { MatchCard } from '@/components/match-card';
import { getMatchesForDate, todayInIstISO } from '@/lib/queries';
import { FAVORITES } from '@/lib/favorites';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const today = todayInIstISO();
  const matches = await getMatchesForDate(today);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-5 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Today</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarBlank weight="duotone" className="size-3.5" />
            <span className="font-mono tabular-nums">{today}</span>
          </p>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Watching:{' '}
          <span className="text-foreground/80">{FAVORITES.join(' · ')}</span>
        </p>
      </header>

      {matches.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No matches found for today.
            </p>
            <Link
              href="/upload"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
            >
              Upload tonight&apos;s panel
              <ArrowRight weight="bold" className="size-4" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </main>
  );
}

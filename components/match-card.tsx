import Link from 'next/link';
import { ArrowRight, Clock } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PanelCard } from '@/components/panel-card';
import type { MatchWithPanels } from '@/lib/queries';

const FEED_PLACEHOLDERS = [
  { id: 'english', displayName: 'English' },
  { id: 'star-sports-hindi', displayName: 'Star Sports Hindi' },
  { id: 'jiohotstar-hindi-championswaali', displayName: 'JioHotstar Hindi (Championswaali)' },
] as const;

function formatToss(tossAt: Date | null): string {
  if (!tossAt) return '';
  return tossAt.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

export function MatchCard({ match }: { match: MatchWithPanels }) {
  const tossLabel = formatToss(
    match.tossAt instanceof Date ? match.tossAt : match.tossAt ? new Date(match.tossAt) : null
  );

  const presentFeedIds = new Set(match.panels.map((p) => p.feedId));
  const missingFeeds = FEED_PLACEHOLDERS.filter((f) => !presentFeedIds.has(f.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/match/${match.id}`}
            className="text-base font-semibold tracking-tight hover:underline"
          >
            {match.homeTeam} <span className="text-muted-foreground">vs</span>{' '}
            {match.awayTeam}
          </Link>
          {tossLabel ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock weight="duotone" className="size-3.5" />
              <span className="font-mono tabular-nums">{tossLabel}</span>
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {match.panels.length === 0 ? (
          <Link
            href="/upload"
            className="flex items-center justify-between rounded-md border border-dashed bg-muted/40 px-3 py-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <span>No panel uploaded yet — tap to add one.</span>
            <ArrowRight weight="bold" className="size-4" />
          </Link>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {match.panels.map((panel) => (
              <PanelCard key={panel.id} panel={panel} />
            ))}
            {missingFeeds.map((f) => (
              <Card key={f.id} className="border-dashed">
                <CardContent className="py-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground/70">
                    {f.displayName}
                  </p>
                  <p className="mt-1">No panel for this feed yet.</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

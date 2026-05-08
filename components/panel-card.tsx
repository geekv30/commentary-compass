import {
  Star,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { isFavorite } from '@/lib/favorites';
import type { PanelWithEntries } from '@/lib/queries';

export function PanelCard({ panel }: { panel: PanelWithEntries }) {
  const unverified = panel.status === 'unverified';
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{panel.feedDisplay.displayName}</h3>
          {unverified ? (
            <Badge variant="secondary" className="gap-1 text-xs">
              <WarningCircle weight="duotone" className="size-3" />
              <span>
                Confidence{' '}
                <span className="font-mono tabular-nums">
                  {panel.confidence.toFixed(2)}
                </span>
              </span>
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {panel.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No commentators extracted
          </p>
        ) : (
          <ul className="space-y-1.5">
            {panel.entries.map((entry) => {
              const fav = isFavorite(entry.nameAsShown);
              return (
                <li
                  key={entry.id}
                  className={
                    fav
                      ? 'flex items-center gap-2 rounded-md border-l-2 border-amber-500 bg-amber-500/5 px-2 py-1 text-sm font-medium'
                      : 'flex items-center gap-2 px-2 py-1 text-sm'
                  }
                >
                  {fav ? (
                    <Star
                      weight="fill"
                      className="size-4 shrink-0 text-amber-500"
                    />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden />
                  )}
                  <span>{entry.nameAsShown}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

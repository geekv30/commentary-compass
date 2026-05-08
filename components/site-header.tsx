import Link from 'next/link';
import { Compass } from '@phosphor-icons/react/dist/ssr';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link
          href="/today"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <Compass weight="duotone" className="size-5" />
          <span>Commentary Compass</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/today"
            className="rounded-md px-3 py-1.5 hover:bg-muted"
          >
            Today
          </Link>
          <Link
            href="/history"
            className="rounded-md px-3 py-1.5 hover:bg-muted"
          >
            History
          </Link>
          <Link
            href="/upload"
            className="rounded-md px-3 py-1.5 hover:bg-muted"
          >
            Upload
          </Link>
        </nav>
      </div>
    </header>
  );
}

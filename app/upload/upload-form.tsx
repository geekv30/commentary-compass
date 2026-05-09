'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CloudArrowUp,
  LinkSimple,
  WarningCircle,
  CheckCircle,
  ImageSquare,
  X,
} from '@phosphor-icons/react';

type Status = 'idle' | 'fetching' | 'parsing' | 'error' | 'success';

type ApiResponse =
  | { ok: true; matchId: string; panelsStored: number }
  | { ok: false; error: string; fallbackToFile?: boolean };

export function UploadForm() {
  const router = useRouter();
  const [tab, setTab] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  function clearFile() {
    pickFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus('fetching');
    setError(null);

    const fd = new FormData();
    fd.append('source_url', url.trim());

    const res = await fetch('/api/parse', { method: 'POST', body: fd });
    const data = (await res.json()) as ApiResponse;

    if (!data.ok) {
      setError(data.error);
      setStatus('error');
      if (data.fallbackToFile) setTab('file');
      return;
    }
    setStatus('success');
    router.push(`/match/${data.matchId}`);
  }

  async function handleFileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus('parsing');
    setError(null);

    const fd = new FormData();
    fd.append('image', file);

    const res = await fetch('/api/parse', { method: 'POST', body: fd });
    const data = (await res.json()) as ApiResponse;

    if (!data.ok) {
      setError(data.error);
      setStatus('error');
      return;
    }
    setStatus('success');
    router.push(`/match/${data.matchId}`);
  }

  const busy = status === 'fetching' || status === 'parsing';

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload tonight&apos;s panel</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'url' | 'file')}>
            <TabsList className="grid h-12 w-full grid-cols-2">
              <TabsTrigger value="url" className="gap-2 h-10 text-sm">
                <LinkSimple weight="duotone" className="size-4" />
                Paste URL
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-2 h-10 text-sm">
                <CloudArrowUp weight="duotone" className="size-4" />
                Upload file
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-5">
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="post-url" className="text-sm">
                    X post URL
                  </Label>
                  <Input
                    id="post-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://x.com/JioHotstar/status/…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={busy}
                    className="h-12 text-base"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-base"
                  disabled={busy || !url.trim()}
                >
                  {status === 'fetching'
                    ? 'Fetching from X…'
                    : status === 'parsing'
                    ? 'Parsing…'
                    : 'Fetch and parse'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="file" className="mt-5">
              <form onSubmit={handleFileSubmit} className="space-y-4">
                <input
                  ref={fileInputRef}
                  id="image-file"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />

                {previewUrl ? (
                  <div className="relative overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Selected panel"
                      className="block max-h-72 w-full object-contain bg-muted"
                    />
                    <button
                      type="button"
                      onClick={clearFile}
                      aria-label="Remove image"
                      className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-background/90 shadow ring-1 ring-border hover:bg-background"
                    >
                      <X weight="bold" className="size-4" />
                    </button>
                  </div>
                ) : (
                  <Label
                    htmlFor="image-file"
                    className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors ${
                      busy ? 'pointer-events-none opacity-60' : 'hover:bg-muted/50'
                    }`}
                  >
                    <ImageSquare
                      weight="duotone"
                      className="size-10 text-muted-foreground"
                    />
                    <div className="text-sm font-medium">
                      Tap to choose a panel image
                    </div>
                    <div className="text-xs text-muted-foreground">
                      JPG, PNG, or WebP
                    </div>
                  </Label>
                )}

                {file ? (
                  <p className="text-xs text-muted-foreground">
                    {file.name} ·{' '}
                    <span className="font-mono tabular-nums">
                      {Math.round(file.size / 1024)}
                    </span>
                    {' '}KB
                  </p>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-base"
                  disabled={busy || !file}
                >
                  {status === 'parsing' ? 'Parsing…' : 'Parse panel'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {error ? (
            <div className="mt-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <WarningCircle
                weight="duotone"
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
              <span>{error}</span>
            </div>
          ) : null}

          {status === 'success' ? (
            <div className="mt-5 flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <CheckCircle
                weight="duotone"
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
              />
              <span>Parsed. Redirecting…</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

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
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload tonight&apos;s panel</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'url' | 'file')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url" className="gap-2">
                <LinkSimple weight="duotone" className="size-4" />
                Paste URL
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-2">
                <CloudArrowUp weight="duotone" className="size-4" />
                Upload file
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-4">
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="post-url">X post URL</Label>
                  <Input
                    id="post-url"
                    type="url"
                    placeholder="https://x.com/JioHotstar/status/…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
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

            <TabsContent value="file" className="mt-4">
              <form onSubmit={handleFileSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image-file">Panel image</Label>
                  <Input
                    id="image-file"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    disabled={busy}
                  />
                  {file ? (
                    <p className="text-xs text-muted-foreground">
                      {file.name} ·{' '}
                      <span className="font-mono tabular-nums">
                        {Math.round(file.size / 1024)}
                      </span>
                      {' '}KB
                    </p>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || !file}
                >
                  {status === 'parsing' ? 'Parsing…' : 'Parse panel'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <WarningCircle
                weight="duotone"
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
              <span>{error}</span>
            </div>
          ) : null}

          {status === 'success' ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
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

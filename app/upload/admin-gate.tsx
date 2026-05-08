'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from '@phosphor-icons/react';
import { submitAdminSecret } from './actions';

type State = { ok: boolean; error?: string } | undefined;

async function action(_prev: State, formData: FormData): Promise<State> {
  return await submitAdminSecret(formData);
}

export function AdminGate() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    action,
    undefined
  );

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock weight="duotone" className="size-5" />
            Admin gate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secret">Admin secret</Label>
              <Input
                id="secret"
                name="secret"
                type="password"
                autoComplete="off"
                required
              />
            </div>
            {state?.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Checking…' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

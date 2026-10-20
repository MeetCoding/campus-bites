import { Check, Copy, Dices } from 'lucide-react';
import { useState } from 'react';

import { Button, Notice, TextField } from '@/components/ui';
import { formatPhone } from '@/lib/format';
import { generatePasscode } from '@/lib/passcode';

/** 6-digit passcode input with a "Generate" button (random, never a guessable one). */
export function PasscodeField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (passcode: string) => void;
  error?: string | null;
}) {
  return (
    <div className="flex items-start gap-space-sm">
      <TextField
        label="6-digit passcode"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        error={error}
        className="w-40"
        style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.2em' }}
      />
      <Button
        variant="ghost"
        className="mt-6"
        icon={<Dices className="size-4" aria-hidden />}
        onClick={() => onChange(generatePasscode())}>
        Generate
      </Button>
    </div>
  );
}

/**
 * Shown once after a passcode is saved: Supabase stores only a hash, so this is the admin's one
 * chance to copy it for the vendor.
 */
export function PasscodeReveal({
  phone,
  passcode,
  onDone,
}: {
  phone: string;
  passcode: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-space-sm rounded-2xl bg-tertiary-fixed/50 p-space-md">
      <p className="text-body-md text-on-surface">
        Passcode for <span className="font-semibold">{formatPhone(phone)}</span>
      </p>
      <div className="flex flex-wrap items-center gap-space-sm">
        <code className="rounded-xl bg-surface-container-lowest px-space-md py-space-sm font-label text-headline-md tracking-[0.3em] text-on-surface">
          {passcode}
        </code>
        <Button
          size="sm"
          icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          onClick={() => {
            void navigator.clipboard.writeText(passcode).then(() => setCopied(true));
          }}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
      <Notice tone="success">
        Share it with the vendor privately. It won't be shown again; set a new one if it's lost.
      </Notice>
    </div>
  );
}

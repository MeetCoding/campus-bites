import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import crest from '@/assets/iitr-crest.png';
import { Notice } from '@/components/ui';
import { useSession } from '@/lib/session';

export function SignInPage() {
  const session = useSession();
  const [pending, setPending] = useState(false);
  const notice = session.status === 'signed-out' ? session.notice : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-linear-to-br from-hero to-primary p-space-md">
      <div className="flex w-full max-w-md flex-col items-center gap-space-lg rounded-4xl bg-surface-container-lowest p-space-xl text-center shadow-[0_24px_60px_rgb(0_25_70/0.06)]">
        <img src={crest} alt="IIT Roorkee crest" className="size-20" />
        <div className="flex flex-col gap-space-xs">
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Campus Bites</h1>
          <p className="font-label text-label-md uppercase tracking-widest text-tertiary">Admin console</p>
        </div>
        <p className="text-body-lg text-on-surface-variant">
          Sign in with an admin's IITR Google account to manage admins, vendors and campus eateries.
        </p>
        <button
          type="button"
          disabled={pending || session.status === 'loading'}
          onClick={() => {
            setPending(true);
            void session.signIn().finally(() => setPending(false));
          }}
          className="flex h-12 w-full items-center justify-center gap-space-sm rounded-full bg-inverse-surface px-space-md font-body font-semibold text-inverse-on-surface transition hover:brightness-125 disabled:opacity-60">
          {pending ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-surface-container-lowest font-bold text-primary">
              G
            </span>
          )}
          {pending ? 'Opening Google…' : 'Continue with IITR Google'}
        </button>
        {notice ? <Notice>{notice}</Notice> : null}
      </div>
    </main>
  );
}

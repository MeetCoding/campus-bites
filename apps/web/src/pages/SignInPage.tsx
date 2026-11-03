import { LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

import { BrandSymbol, Wordmark } from '@/components/BrandMark';
import { DriftingOrbs } from '@/components/motion';
import { Notice } from '@/components/ui';
import { useSession } from '@/lib/session';

export function SignInPage() {
  const session = useSession();
  const [pending, setPending] = useState(false);
  const notice = session.status === 'signed-out' ? session.notice : null;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-linear-to-br from-hero to-primary p-space-md">
      <DriftingOrbs variant="page" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative flex w-full max-w-md flex-col items-center gap-space-lg rounded-3xl bg-surface-container-lowest p-space-xl text-center shadow-[0_24px_60px_rgb(31_49_40/0.08)]">
        <BrandSymbol animated className="h-20" />
        <div className="flex flex-col gap-space-xs">
          <h1>
            <Wordmark kinetic className="text-headline-lg" />
          </h1>
          <p className="font-label text-label-md uppercase tracking-widest text-tertiary">Admin console</p>
        </div>
        <p className="text-body-lg text-on-surface-variant">
          Sign in with an admin's IITR Google account to manage admins, vendors and campus eateries.
        </p>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={pending || session.status === 'loading'}
          onClick={() => {
            setPending(true);
            void session.signIn().finally(() => setPending(false));
          }}
          className="group relative flex h-12 w-full items-center justify-center gap-space-sm overflow-hidden rounded-xl bg-inverse-surface px-space-md font-body font-semibold text-inverse-on-surface transition-[filter] hover:brightness-125 disabled:opacity-60">
          {pending ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-surface-container-lowest font-bold text-primary">
              G
            </span>
          )}
          {pending ? 'Opening Google…' : 'Continue with IITR Google'}
        </motion.button>
        <AnimatePresence>
          {notice ? (
            <motion.div
              key="notice"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full overflow-hidden">
              <Notice>{notice}</Notice>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

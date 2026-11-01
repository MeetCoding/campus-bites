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
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 140 }}
        className="relative flex w-full max-w-md flex-col items-center gap-space-lg rounded-4xl bg-surface-container-lowest p-space-xl text-center shadow-[0_24px_60px_rgb(31_49_40/0.08)]">
        <BrandSymbol animated className="h-20" />
        <div className="flex flex-col gap-space-xs">
          <h1>
            <Wordmark kinetic className="text-headline-lg" />
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75, duration: 0.5 }}
            className="font-label text-label-md uppercase tracking-widest text-tertiary">
            Admin console
          </motion.p>
        </div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="text-body-lg text-on-surface-variant">
          Sign in with an admin's IITR Google account to manage admins, vendors and campus eateries.
        </motion.p>
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, type: 'spring', damping: 18, stiffness: 200 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          disabled={pending || session.status === 'loading'}
          onClick={() => {
            setPending(true);
            void session.signIn().finally(() => setPending(false));
          }}
          className="group relative flex h-12 w-full items-center justify-center gap-space-sm overflow-hidden rounded-full bg-inverse-surface px-space-md font-body font-semibold text-inverse-on-surface transition-[filter] hover:brightness-125 disabled:opacity-60">
          {/* A light sweep across the button on hover. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/15 transition-transform duration-700 ease-out group-hover:translate-x-[450%]"
          />
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

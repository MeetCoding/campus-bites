import { cn } from '@/lib/cn';

type Orb = { className: string };

const ORBS: Record<'page' | 'panel', Orb[]> = {
  // Full-screen backdrop (sign-in).
  page: [
    { className: 'left-[-10%] top-[-15%] size-[36rem] bg-accent/30' },
    { className: 'bottom-[-20%] right-[-10%] size-[40rem] bg-primary-fixed-dim/25' },
  ],
  // Inside a hero panel (page headers).
  panel: [
    { className: 'right-[-6rem] top-[-8rem] size-80 bg-tertiary-container/30' },
    { className: 'bottom-[-9rem] left-[-5rem] size-72 bg-primary-container/35' },
  ],
};

/** Soft blurred glows behind a hero. Still: nothing loops, nothing competes with the content. */
export function DriftingOrbs({ variant }: { variant: 'page' | 'panel' }) {
  return ORBS[variant].map((orb, i) => (
    <div key={i} aria-hidden className={cn('pointer-events-none absolute rounded-full blur-3xl', orb.className)} />
  ));
}

/** A hero title. The old letter-by-letter spring was slow; the header's own fade-in is enough. */
export function KineticText({ text }: { text: string }) {
  return <>{text}</>;
}

import { motion } from 'motion/react';

import { cn } from '@/lib/cn';

type Orb = { className: string; drift: { x: number[]; y: number[] }; duration: number };

const ORBS: Record<'page' | 'panel', Orb[]> = {
  // Full-screen backdrop (sign-in).
  page: [
    { className: 'left-[-10%] top-[-15%] size-[36rem] bg-accent/30', drift: { x: [0, 60, 0], y: [0, 40, 0] }, duration: 14 },
    { className: 'bottom-[-20%] right-[-10%] size-[40rem] bg-primary-fixed-dim/25', drift: { x: [0, -50, 0], y: [0, -30, 0] }, duration: 18 },
    { className: 'right-[20%] top-[10%] size-64 bg-tertiary-fixed-dim/20', drift: { x: [0, -30, 0], y: [0, 50, 0] }, duration: 11 },
  ],
  // Inside a hero panel (page headers).
  panel: [
    { className: 'right-[-6rem] top-[-8rem] size-80 bg-tertiary-container/35', drift: { x: [0, -40, 0], y: [0, 30, 0] }, duration: 9 },
    { className: 'bottom-[-9rem] left-[-5rem] size-72 bg-primary-container/40', drift: { x: [0, 45, 0], y: [0, -20, 0] }, duration: 12 },
  ],
};

/** Soft blurred glows drifting on a loop (MotionConfig stills them for reduced motion). */
export function DriftingOrbs({ variant }: { variant: 'page' | 'panel' }) {
  return ORBS[variant].map((orb, i) => (
    <motion.div
      key={i}
      aria-hidden
      className={cn('pointer-events-none absolute rounded-full blur-3xl', orb.className)}
      animate={orb.drift}
      transition={{ duration: orb.duration, repeat: Infinity, ease: 'easeInOut' }}
    />
  ));
}

/**
 * A title with the sign-in wordmark's motion: letters spring up one after another, words wrap as
 * units. Screen readers get the plain text.
 */
export function KineticText({ text, delay = 0.1 }: { text: string; delay?: number }) {
  const words = text.split(' ');
  // Index of each word's first letter in the whole title, so the stagger runs across words.
  const starts = words.map((_, w) => words.slice(0, w).reduce((n, word) => n + word.length, 0));
  return (
    <>
      <span className="sr-only">{text}</span>
      {words.map((word, w) => (
        <span key={`${text}-${w}`} aria-hidden className="mr-[0.25em] inline-flex last:mr-0">
          {Array.from(word, (ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ y: '0.6em', opacity: 0, rotate: 8 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 180, delay: delay + Math.min(starts[w] + i, 24) * 0.03 }}>
              {ch}
            </motion.span>
          ))}
        </span>
      ))}
    </>
  );
}

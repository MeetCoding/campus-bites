import { motion, type Transition } from 'motion/react';

import { cn } from '@/lib/cn';

// Vector paths from brand-kit/CampusBites_Logo.svg, cropped to the symbol's own bounds.
// Inline SVG (not <img>) so the fills follow the theme tokens and the parts can animate.
const C_PATH =
  'M 148 40 C 89 40 42 87 42 146 C 42 206 89 252 148 252 C 193 252 226 231 245 196 Q 250 186 240 180 L 217 167 Q 208 162 202 172 C 191 191 173 201 148 201 C 118 201 94 178 94 146 C 94 114 118 91 148 91 C 174 91 192 102 204 122 Q 210 130 219 124 L 243 108 Q 251 103 245 93 C 226 59 192 40 148 40 Z';
const TAIL_PATH = 'M 111 192 L 105 221 Q 104 225 108 223 L 135 206 Z';
const BITE_PATHS = [
  'M 249 132 L 279 115 Q 289 109 294 118 Q 298 126 287 132 L 258 149 Q 246 155 242 145 Q 239 138 249 132 Z',
  'M 255 165 L 286 165 Q 299 165 299 176 Q 299 186 286 185 L 255 183 Q 244 182 244 173 Q 245 165 255 165 Z',
];

type Tone = 'color' | 'onDark';

const LOGO_SPRING: Transition = { type: 'spring', damping: 18, stiffness: 260, mass: 0.7 };

/**
 * The Campus Bites symbol. `onDark` is the app-icon colouring: timberwolf "C", sage bites.
 * `animated`: a quick entrance (the "C" turns in, the bites slide out), then it stays still
 * (MotionConfig turns even that off for reduced motion).
 */
export function BrandSymbol({
  className,
  tone = 'color',
  animated = false,
}: {
  className?: string;
  tone?: Tone;
  animated?: boolean;
}) {
  const onDark = tone === 'onDark';
  return (
    <svg viewBox="40 38 262 216" className={cn('h-9 w-auto overflow-visible', className)} role="img" aria-label="Campus Bites logo">
      <motion.g
        initial={animated ? { scale: 0.7, rotate: -45, opacity: 0 } : false}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={LOGO_SPRING}>
        <path className={onDark ? 'fill-background' : 'fill-primary'} d={C_PATH} />
        <path className={onDark ? 'fill-inverse-surface' : 'fill-background'} d={TAIL_PATH} />
      </motion.g>
      {BITE_PATHS.map((d, i) => (
        <motion.g
          key={d}
          initial={animated ? { x: -46, opacity: 0 } : false}
          animate={animated ? { x: 0, opacity: 1 } : undefined}
          transition={animated ? { ...LOGO_SPRING, delay: 0.1 + i * 0.06 } : undefined}>
          <path className={onDark ? 'fill-tertiary-container' : 'fill-accent'} d={d} />
        </motion.g>
      ))}
    </svg>
  );
}

const LETTERS = [
  ...Array.from('Campus', (ch) => ({ ch, accent: false })),
  ...Array.from('Bites', (ch) => ({ ch, accent: true })),
];

/**
 * "CampusBites" wordmark in Nunito Sans ExtraBold, "Bites" in fern. `kinetic` springs the
 * letters up one after another.
 */
export function Wordmark({ className, kinetic = false, delay = 0.05 }: { className?: string; kinetic?: boolean; delay?: number }) {
  if (!kinetic) {
    return (
      <span className={cn('font-headline font-extrabold tracking-tight text-primary', className)}>
        Campus<span className="text-accent">Bites</span>
      </span>
    );
  }
  return (
    <span aria-label="CampusBites" className={cn('inline-flex font-headline font-extrabold tracking-tight text-primary', className)}>
      {LETTERS.map(({ ch, accent }, i) => (
        <motion.span
          key={i}
          aria-hidden
          className={cn('inline-block', accent && 'text-accent')}
          initial={{ y: '0.3em', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut', delay: delay + i * 0.018 }}>
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

import { Building2, LogOut, Shield, Store, UtensilsCrossed } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';

import { BrandSymbol, Wordmark } from '@/components/BrandMark';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/session';

const NAV = [
  { to: '/vendors', label: 'Vendors', icon: Store },
  { to: '/hostels', label: 'Hostels', icon: Building2 },
  { to: '/eateries', label: 'Eateries', icon: UtensilsCrossed },
  { to: '/admins', label: 'Admins', icon: Shield },
];

export function Layout({ children }: { children: ReactNode }) {
  const session = useSession();
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 bg-surface-container-lowest/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-space-lg gap-y-space-sm px-space-md py-space-sm">
          <motion.div whileHover="hover" className="flex items-center gap-space-sm">
            <motion.span variants={{ hover: { rotate: -12, scale: 1.08 } }} transition={{ type: 'spring', damping: 10, stiffness: 300 }}>
              <BrandSymbol animated />
            </motion.span>
            <div className="flex flex-col leading-tight">
              <Wordmark className="text-headline-sm" />
              <span className="font-label text-label-sm uppercase tracking-widest text-tertiary">Admin</span>
            </div>
          </motion.div>
          <nav aria-label="Sections" className="order-last flex w-full gap-space-xs overflow-x-auto sm:order-none sm:w-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'relative inline-flex h-9 items-center gap-space-sm rounded-full px-space-md font-label text-label-lg transition-colors',
                    isActive ? 'text-on-primary-fixed-variant' : 'text-on-surface-variant hover:bg-surface-container-low',
                  )
                }>
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      // One highlight shared across links, so it slides to the new section.
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-full bg-primary-fixed"
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                      />
                    ) : null}
                    <Icon className="relative size-4" aria-hidden />
                    <span className="relative">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-space-sm">
            <span className="hidden truncate text-body-sm text-on-surface-variant md:inline">
              {session.status === 'admin' ? session.email : null}
            </span>
            <Button size="sm" variant="ghost" icon={<LogOut className="size-4" aria-hidden />} onClick={() => void session.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-5xl px-space-md py-space-xl">
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}

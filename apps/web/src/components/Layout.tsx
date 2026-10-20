import { Building2, LogOut, Shield, Store, UtensilsCrossed } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

import crest from '@/assets/iitr-crest.png';
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

  return (
    <div className="min-h-dvh">
      <header className="bg-surface-container-lowest">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-space-lg gap-y-space-sm px-space-md py-space-sm">
          <div className="flex items-center gap-space-sm">
            <img src={crest} alt="" className="size-9" />
            <div className="flex flex-col leading-tight">
              <span className="font-headline text-headline-sm font-bold">Campus Bites</span>
              <span className="font-label text-label-sm uppercase tracking-widest text-tertiary">Admin</span>
            </div>
          </div>
          <nav aria-label="Sections" className="order-last flex w-full gap-space-xs overflow-x-auto sm:order-none sm:w-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-9 items-center gap-space-sm rounded-full px-space-md font-label text-label-lg transition',
                    isActive
                      ? 'bg-primary-fixed text-on-primary-fixed-variant'
                      : 'text-on-surface-variant hover:bg-surface-container-low',
                  )
                }>
                <Icon className="size-4" aria-hidden />
                {label}
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
      <main className="mx-auto max-w-5xl px-space-md py-space-xl">{children}</main>
    </div>
  );
}

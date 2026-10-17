import { useSession } from '@/features/auth/session';
import { useOutlets, type Outlet } from '@/features/campus/queries';
import { useSecretaryBhawans } from '@/features/mess/queries';

const ORDER: Record<Outlet['type'], number> = { eatery: 0, day_canteen: 1, night_canteen: 2, mess: 3 };

/**
 * Canteens/eateries the signed-in staff member runs: whitelisted vendor outlets (JWT) plus both
 * canteens of every Bhawan where they are Bhawan Secretary (live). Mirrors app.can_run_outlet();
 * RLS remains the real check.
 */
export function useManagedOutlets() {
  const { claims } = useSession();
  const outlets = useOutlets();
  const secretaryOf = useSecretaryBhawans('bhawan_secretary');

  const data = outlets.data
    ?.filter(
      (o) =>
        o.type !== 'mess' &&
        (claims?.outlet_ids.includes(o.id) ||
          (o.bhawan_id !== null && (secretaryOf.data ?? []).some((b) => b.id === o.bhawan_id))),
    )
    .sort((a, b) => ORDER[a.type] - ORDER[b.type] || a.name.localeCompare(b.name));

  return { data, isPending: outlets.isPending || secretaryOf.isPending, isBhawanSecretary: !!secretaryOf.data?.length };
}

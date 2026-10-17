import { Screen } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { ComplaintQueue } from '@/features/complaints/ComplaintQueue';
import type { ComplaintDomain } from '@/features/complaints/logic';

/** Mess / Bhawan Secretary complaint queue (TASKS M6.11). RLS limits rows to their Bhawans. */
export default function StaffComplaints() {
  const { claims } = useSession();
  const domains: ComplaintDomain[] = [];
  if (claims?.roles.includes('mess_secretary')) domains.push('mess');
  if (claims?.roles.includes('bhawan_secretary')) domains.push('hostel_canteen');

  return (
    <Screen>
      <ComplaintQueue title="Complaints routed to you" domains={domains} />
    </Screen>
  );
}

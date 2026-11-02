import { Trash2, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button, Card, ConfirmButton, EmptyState, Loading, Notice, PageHeader, Pill, SelectField, TextField } from '@/components/ui';
import { useHostels } from '@/features/hostels/queries';
import {
  useAssignRole,
  useRevokeRole,
  useRoleAssignments,
  type OfficeRole,
  type RoleAssignment,
} from '@/features/roles/queries';
import { errorMessage } from '@/lib/api';

const IITR_EMAIL = /^[^@\s]+@([a-z0-9-]+\.)?iitr\.ac\.in$/;

type RoleInfo = { label: string; plural: string; scoped: boolean; blurb: string };

const ROLES: Record<OfficeRole, RoleInfo> = {
  mess_secretary: {
    label: 'Mess Secretary',
    plural: 'Mess Secretaries',
    scoped: true,
    blurb: 'Handles mess complaints, menus and timing overrides. One per Bhawan.',
  },
  bhawan_secretary: {
    label: 'Bhawan Secretary',
    plural: 'Bhawan Secretaries',
    scoped: true,
    blurb: 'Runs the Bhawan’s canteens, rate card and hostel-canteen complaints.',
  },
  mess_authority: {
    label: 'Bhawan Administration (Warden office)',
    plural: 'Bhawan Administration (Warden office)',
    scoped: true,
    blurb: 'Approves mess rebates and sees escalated complaints for their Bhawan.',
  },
  adosw: {
    label: 'ADoSW',
    plural: 'ADoSW',
    scoped: false,
    blurb: 'Campus-wide. Handles eatery complaints and oversees every complaint.',
  },
};
const ROLE_ORDER: OfficeRole[] = ['mess_secretary', 'bhawan_secretary', 'mess_authority', 'adosw'];

function isOfficeRole(role: string): role is OfficeRole {
  return role in ROLES;
}

export function RolesPage() {
  const assignments = useRoleAssignments();
  const office = assignments.data?.filter((a): a is RoleAssignment & { role: OfficeRole } => isOfficeRole(a.role)) ?? [];

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        title="Roles & contacts"
        subtitle="Who students and officials contact for each Bhawan: Mess Secretary, Bhawan Secretary and Bhawan Administration, plus the campus-wide ADoSW. They must have signed in to Campus Bites once with their IITR Google account."
      />
      <AssignRoleForm />
      {assignments.isPending ? <Loading /> : null}
      {assignments.error ? <Notice>{errorMessage(assignments.error)}</Notice> : null}
      {ROLE_ORDER.map((role) => (
        <RoleSection key={role} role={role} rows={office.filter((a) => a.role === role)} loaded={Boolean(assignments.data)} />
      ))}
    </div>
  );
}

function AssignRoleForm() {
  const hostels = useHostels();
  const assign = useAssignRole();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OfficeRole>('mess_secretary');
  const [bhawanId, setBhawanId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const scoped = ROLES[role].scoped;

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!IITR_EMAIL.test(value)) {
      setProblem('Use an @iitr.ac.in Google account (e.g. name@ece.iitr.ac.in).');
      return;
    }
    if (scoped && !bhawanId) {
      setProblem('Choose a Bhawan.');
      return;
    }
    setProblem(null);
    assign.mutate(
      { email: value, role, bhawan_id: scoped ? bhawanId : null },
      {
        onSuccess: (row) => {
          setDone(`${row.email ?? value} is now ${ROLES[role].label}${row.bhawan_name ? ` · ${row.bhawan_name}` : ''}. Their new console appears after their next sign-in.`);
          setEmail('');
        },
      },
    );
  }

  function reset() {
    setProblem(null);
    setDone(null);
    assign.reset();
  }

  const apiError = assign.error ? errorMessage(assign.error) : null;

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <div className="grid gap-space-md sm:grid-cols-3">
          <SelectField
            label="Role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as OfficeRole);
              reset();
            }}
          >
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLES[r].label}
              </option>
            ))}
          </SelectField>
          {scoped ? (
            <SelectField
              label="Bhawan"
              value={bhawanId}
              onChange={(e) => {
                setBhawanId(e.target.value);
                reset();
              }}
            >
              <option value="">Choose a Bhawan…</option>
              {hostels.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </SelectField>
          ) : null}
          <TextField
            label="IITR email"
            type="email"
            autoComplete="off"
            placeholder="name@dept.iitr.ac.in"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              reset();
            }}
            error={problem ?? apiError}
          />
        </div>
        <p className="text-body-sm text-on-surface-variant">{ROLES[role].blurb}</p>
        <div>
          <Button type="submit" variant="primary" loading={assign.isPending} icon={<UserPlus className="size-4" />}>
            Assign role
          </Button>
        </div>
      </form>
      {done ? (
        <div className="mt-space-md">
          <Notice tone="success">{done}</Notice>
        </div>
      ) : null}
    </Card>
  );
}

function RoleSection({ role, rows, loaded }: { role: OfficeRole; rows: RoleAssignment[]; loaded: boolean }) {
  const info = ROLES[role];
  return (
    <Card className="flex flex-col gap-space-sm">
      <h2 className="font-serif text-headline-sm font-medium">
        {info.plural} {loaded ? <span className="text-on-surface-variant">({rows.length})</span> : null}
      </h2>
      {loaded && rows.length === 0 ? <EmptyState>No one assigned yet.</EmptyState> : null}
      <ul className="flex flex-col gap-space-xs">
        {rows.map((row) => (
          <RoleItem key={row.id} row={row} />
        ))}
      </ul>
    </Card>
  );
}

function RoleItem({ row }: { row: RoleAssignment }) {
  const revoke = useRevokeRole();
  return (
    <li className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low px-space-md py-space-sm sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-on-surface">{row.full_name ?? row.email ?? 'Unknown user'}</span>
        {row.email ? (
          <a href={`mailto:${row.email}`} className="truncate text-body-sm text-on-surface-variant underline-offset-2 hover:underline">
            {row.email}
          </a>
        ) : null}
        {revoke.error ? <span className="text-body-sm text-error">{errorMessage(revoke.error)}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-space-sm">
        {row.bhawan_name ? <Pill tone="official">{row.bhawan_name}</Pill> : <Pill>Campus-wide</Pill>}
        <ConfirmButton
          label="Remove"
          confirmLabel="Remove role"
          icon={<Trash2 className="size-4" aria-hidden />}
          loading={revoke.isPending}
          onConfirm={() => revoke.mutate(row.id)}
        />
      </div>
    </li>
  );
}

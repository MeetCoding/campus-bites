import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button, Card, ConfirmButton, EmptyState, Loading, Notice, PageHeader, Pill, TextField } from '@/components/ui';
import { useAddAdmin, useAdmins, useRemoveAdmin, type AdminRow } from '@/features/admins/queries';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/session';

const IITR_EMAIL = /^[^@\s]+@([a-z0-9-]+\.)?iitr\.ac\.in$/;

export function AdminsPage() {
  const admins = useAdmins();

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        title="Admins"
        subtitle="Only these IITR Google accounts can sign in to this console and to Admin mode in the app. Someone who hasn't used Campus Bites yet becomes an admin the first time they sign in."
      />
      <AddAdminForm />
      <Card className="flex flex-col gap-space-sm">
        <h2 className="font-serif text-headline-sm font-medium">
          {admins.data ? `${admins.data.length} admin${admins.data.length === 1 ? '' : 's'}` : 'Admins'}
        </h2>
        {admins.isPending ? <Loading /> : null}
        {admins.error ? <Notice>{errorMessage(admins.error)}</Notice> : null}
        {admins.data?.length === 0 ? <EmptyState>No admins yet.</EmptyState> : null}
        <ul className="flex flex-col gap-space-xs">
          {admins.data?.map((admin) => <AdminItem key={admin.email} admin={admin} />)}
        </ul>
      </Card>
    </div>
  );
}

function AddAdminForm() {
  const addAdmin = useAddAdmin();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<AdminRow | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!IITR_EMAIL.test(value)) {
      setProblem('Use an @iitr.ac.in Google account (e.g. name@ece.iitr.ac.in).');
      return;
    }
    setProblem(null);
    addAdmin.mutate(value, {
      onSuccess: (admin) => {
        setAdded(admin);
        setEmail('');
      },
    });
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-space-md sm:flex-row sm:items-start">
        <TextField
          label="IITR email"
          type="email"
          autoComplete="off"
          placeholder="name@dept.iitr.ac.in"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setProblem(null);
            setAdded(null);
            addAdmin.reset();
          }}
          error={problem ?? (addAdmin.error ? errorMessage(addAdmin.error) : null)}
          className="flex-1"
        />
        <Button type="submit" variant="primary" loading={addAdmin.isPending} icon={<UserPlus className="size-4" />} className="sm:mt-6">
          Add admin
        </Button>
      </form>
      {added ? (
        <div className="mt-space-md">
          <Notice tone="success">
            {added.status === 'active'
              ? `${added.email} is now an admin. They may need to sign out and back in to the app.`
              : `${added.email} will become an admin the first time they sign in.`}
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}

function AdminItem({ admin }: { admin: AdminRow }) {
  const session = useSession();
  const remove = useRemoveAdmin();
  const isMe = session.status === 'admin' && session.email.toLowerCase() === admin.email;

  return (
    <li className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low px-space-md py-space-sm sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-on-surface">
          {admin.full_name ?? admin.email}
          {isMe ? <span className="font-normal text-on-surface-variant"> (you)</span> : null}
        </span>
        {admin.full_name ? <span className="truncate text-body-sm text-on-surface-variant">{admin.email}</span> : null}
        {remove.error ? <span className="text-body-sm text-error">{errorMessage(remove.error)}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-space-sm">
        {admin.is_owner ? (
          <Pill tone="official">
            <ShieldCheck className="size-3" aria-hidden /> Owner
          </Pill>
        ) : null}
        {admin.status === 'active' ? (
          <Pill tone="open">Active</Pill>
        ) : (
          <span title={`Added ${formatDateTime(admin.created_at)}`}>
            <Pill tone="warning">Hasn't signed in yet</Pill>
          </span>
        )}
        <ConfirmButton
          label="Remove"
          confirmLabel="Remove admin"
          icon={<Trash2 className="size-4" aria-hidden />}
          loading={remove.isPending}
          disabled={admin.is_owner || isMe}
          disabledReason={admin.is_owner ? "The owner's admin access can't be removed." : 'Ask another admin to remove you.'}
          onConfirm={() => remove.mutate(admin.email)}
        />
      </div>
    </li>
  );
}

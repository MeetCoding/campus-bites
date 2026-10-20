import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button, Card, ConfirmButton, EmptyState, Loading, Notice, PageHeader, TextField } from '@/components/ui';
import {
  useCreateEatery,
  useDeleteEatery,
  useOutlets,
  useUpdateEatery,
  type Outlet,
} from '@/features/eateries/queries';
import { useVendors } from '@/features/vendors/queries';
import { errorMessage } from '@/lib/api';
import { formatPhone } from '@/lib/format';

export function EateriesPage() {
  const outlets = useOutlets();
  const { entries } = useVendors();
  const eateries = outlets.data?.filter((o) => o.type === 'eatery');

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        title="Campus eateries"
        subtitle="Add, rename or remove campus eateries. New ones open 10:00–22:00 until their vendor sets hours. Bhawan messes and canteens come with their Bhawan."
      />
      <AddEateryForm />
      {outlets.isPending ? <Loading /> : null}
      {outlets.error ? <Notice>{errorMessage(outlets.error)}</Notice> : null}
      {eateries?.length === 0 ? <EmptyState>No campus eateries yet.</EmptyState> : null}
      <ul className="flex flex-col gap-space-sm">
        {eateries?.map((eatery) => (
          <EateryItem
            key={eatery.id}
            eatery={eatery}
            vendorPhones={[
              ...new Set(entries?.filter((e) => e.outlet_id === eatery.id).map((e) => e.phone_e164)),
            ]}
          />
        ))}
      </ul>
      <p className="text-body-sm text-on-surface-variant">
        Map pins are set in the app: Admin → Campus eateries, or by the eatery's vendor.
      </p>
    </div>
  );
}

function AddEateryForm() {
  const create = useCreateEatery();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { name: name.trim(), location_tag: location.trim() || null },
      {
        onSuccess: () => {
          setName('');
          setLocation('');
        },
      },
    );
  }

  return (
    <Card>
      <h2 className="mb-space-md font-serif text-headline-sm font-medium">Add an eatery</h2>
      <form onSubmit={submit} className="flex flex-col gap-space-md sm:flex-row sm:items-start">
        <TextField
          label="Name"
          required
          minLength={2}
          maxLength={60}
          placeholder="e.g. Nescafe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <TextField
          label="Location (optional)"
          maxLength={60}
          placeholder="e.g. Near MAC"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="primary" loading={create.isPending} icon={<Plus className="size-4" aria-hidden />} className="sm:mt-6">
          Add eatery
        </Button>
      </form>
      {create.error ? (
        <div className="mt-space-md">
          <Notice>{errorMessage(create.error)}</Notice>
        </div>
      ) : null}
    </Card>
  );
}

function EateryItem({ eatery, vendorPhones }: { eatery: Outlet; vendorPhones: string[] }) {
  const update = useUpdateEatery();
  const remove = useDeleteEatery();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(eatery.name);
  const [location, setLocation] = useState(eatery.location_tag ?? '');

  if (editing) {
    return (
      <li className="rounded-3xl bg-surface-container-lowest p-space-md">
        <form
          className="flex flex-col gap-space-md sm:flex-row sm:items-start"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate(
              { id: eatery.id, name: name.trim(), location_tag: location.trim() || null },
              { onSuccess: () => setEditing(false) },
            );
          }}>
          <TextField label="Name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
          <TextField label="Location" maxLength={60} value={location} onChange={(e) => setLocation(e.target.value)} className="flex-1" />
          <div className="flex gap-space-xs sm:mt-6">
            <Button type="submit" variant="primary" size="sm" loading={update.isPending}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(eatery.name);
                setLocation(eatery.location_tag ?? '');
                update.reset();
              }}>
              Cancel
            </Button>
          </div>
        </form>
        {update.error ? (
          <div className="mt-space-sm">
            <Notice>{errorMessage(update.error)}</Notice>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-space-sm rounded-3xl bg-surface-container-lowest p-space-md sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-space-xs">
        <span className="font-serif text-headline-sm font-medium">{eatery.name}</span>
        <span className="flex flex-wrap items-center gap-x-space-md gap-y-space-xs text-body-sm text-on-surface-variant">
          {eatery.location_tag ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {eatery.location_tag}
            </span>
          ) : null}
          <span>
            {vendorPhones.length
              ? `Vendor${vendorPhones.length > 1 ? 's' : ''}: ${vendorPhones.map(formatPhone).join(', ')}`
              : 'No vendor assigned'}
          </span>
        </span>
        {remove.error ? <span className="text-body-sm text-error">{errorMessage(remove.error)}</span> : null}
      </div>
      <div className="flex items-center gap-space-xs">
        <Button size="sm" variant="ghost" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>
          Edit
        </Button>
        <ConfirmButton
          label="Remove"
          confirmLabel="Remove eatery"
          icon={<Trash2 className="size-4" aria-hidden />}
          loading={remove.isPending}
          onConfirm={() => remove.mutate(eatery.id)}
        />
      </div>
    </li>
  );
}

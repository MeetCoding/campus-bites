import { Moon, Pencil, Plus, Sun, Trash2, UtensilsCrossed } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button, ConfirmButton, Card, EmptyState, Loading, Notice, PageHeader, TextField } from '@/components/ui';
import { useOutlets, type Outlet, type OutletType } from '@/features/eateries/queries';
import { useCreateHostel, useDeleteHostel, useHostels, useRenameHostel, type Hostel } from '@/features/hostels/queries';
import { useVendors, type WhitelistEntry } from '@/features/vendors/queries';
import { errorMessage } from '@/lib/api';
import { formatPhone } from '@/lib/format';

const OUTLET_ORDER: OutletType[] = ['mess', 'day_canteen', 'night_canteen'];
const OUTLET_ICON = { mess: UtensilsCrossed, day_canteen: Sun, night_canteen: Moon, eatery: UtensilsCrossed };

export function HostelsPage() {
  const hostels = useHostels();
  const outlets = useOutlets();
  const { entries } = useVendors();

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        title="Hostels"
        subtitle="Each Bhawan comes with its Mess, Day Canteen and Night Canteen. Adding one creates all three (with default hours); removing it removes them."
      />
      <AddHostelForm />
      {hostels.isPending || outlets.isPending ? <Loading /> : null}
      {hostels.error ? <Notice>{errorMessage(hostels.error)}</Notice> : null}
      {outlets.error ? <Notice>{errorMessage(outlets.error)}</Notice> : null}
      {hostels.data?.length === 0 ? <EmptyState>No hostels yet.</EmptyState> : null}
      <div className="grid gap-space-md lg:grid-cols-2">
        {hostels.data?.map((hostel) => (
          <HostelCard
            key={hostel.id}
            hostel={hostel}
            outlets={(outlets.data ?? [])
              .filter((o) => o.bhawan_id === hostel.id)
              .sort((a, b) => OUTLET_ORDER.indexOf(a.type) - OUTLET_ORDER.indexOf(b.type))}
            entries={entries ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function AddHostelForm() {
  const create = useCreateHostel();
  const [name, setName] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(name.trim(), { onSuccess: () => setName('') });
  }

  return (
    <Card>
      <h2 className="mb-space-md font-serif text-headline-sm font-medium">Add a hostel</h2>
      <form onSubmit={submit} className="flex flex-col gap-space-md sm:flex-row sm:items-start">
        <TextField
          label="Name"
          required
          minLength={3}
          maxLength={60}
          placeholder="e.g. Kasturba Bhawan"
          hint="Its Mess, Day Canteen and Night Canteen are named after it."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="primary" loading={create.isPending} icon={<Plus className="size-4" aria-hidden />} className="sm:mt-6">
          Add hostel
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

function HostelCard({ hostel, outlets, entries }: { hostel: Hostel; outlets: Outlet[]; entries: WhitelistEntry[] }) {
  const rename = useRenameHostel();
  const remove = useDeleteHostel();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(hostel.name);

  return (
    <Card className="flex flex-col gap-space-md">
      {editing ? (
        <form
          className="flex flex-col gap-space-sm sm:flex-row sm:items-start"
          onSubmit={(event) => {
            event.preventDefault();
            rename.mutate({ id: hostel.id, name: name.trim() }, { onSuccess: () => setEditing(false) });
          }}>
          <TextField
            label="Name"
            required
            minLength={3}
            maxLength={60}
            hint="Its outlets are renamed to match."
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={rename.error ? errorMessage(rename.error) : null}
            className="flex-1"
          />
          <div className="flex gap-space-xs sm:mt-6">
            <Button type="submit" size="sm" variant="primary" loading={rename.isPending}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(hostel.name);
                rename.reset();
              }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <h2 className="font-serif text-headline-sm font-medium">{hostel.name}</h2>
          <div className="flex items-center gap-space-xs">
            <Button size="sm" variant="ghost" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>
              Rename
            </Button>
            <ConfirmButton
              label="Remove"
              confirmLabel="Remove hostel + 3 outlets"
              icon={<Trash2 className="size-4" aria-hidden />}
              loading={remove.isPending}
              onConfirm={() => remove.mutate(hostel.id)}
            />
          </div>
        </div>
      )}
      {remove.error ? <Notice>{errorMessage(remove.error)}</Notice> : null}

      <ul className="flex flex-col gap-space-xs">
        {outlets.map((outlet) => {
          const Icon = OUTLET_ICON[outlet.type];
          const phones = [...new Set(entries.filter((e) => e.outlet_id === outlet.id).map((e) => e.phone_e164))];
          return (
            <li key={outlet.id} className="flex flex-col rounded-xl bg-surface-container-low px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-space-md">
              <span className="flex items-center gap-space-sm">
                <Icon className="size-4 text-on-surface-variant" aria-hidden />
                {outlet.name}
              </span>
              <span className="text-body-sm text-on-surface-variant">
                {phones.length ? phones.map(formatPhone).join(', ') : 'No vendor'}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

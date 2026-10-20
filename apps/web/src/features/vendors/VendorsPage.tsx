import { KeyRound, Phone, Plus, Store, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button, Card, ConfirmButton, EmptyState, Loading, Notice, PageHeader, Pill, TextField } from '@/components/ui';
import { OutletSelect } from '@/features/eateries/OutletSelect';
import { useOutlets, type Outlet } from '@/features/eateries/queries';
import { PasscodeField, PasscodeReveal } from '@/features/vendors/PasscodeFields';
import {
  useAssignOutlet,
  useSetPasscode,
  useUnassignOutlet,
  useVendors,
  type Vendor,
} from '@/features/vendors/queries';
import { errorMessage } from '@/lib/api';
import { formatDateTime, formatPhone, toIndianE164 } from '@/lib/format';
import { generatePasscode, passcodeProblem } from '@/lib/passcode';

type Revealed = { phone: string; passcode: string };

export function VendorsPage() {
  const { vendors, isPending, error } = useVendors();
  const outlets = useOutlets();
  const [revealed, setRevealed] = useState<Revealed | null>(null);

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        title="Vendors"
        subtitle="Phone numbers that can sign in to the vendor console, the outlets each one runs, and their sign-in passcodes."
      />
      <AddVendorForm
        outlets={outlets.data ?? []}
        existingPhones={vendors?.map((v) => v.phone) ?? []}
        onPasscodeSet={setRevealed}
      />
      {revealed && !vendors?.some((v) => v.phone === revealed.phone) ? (
        <PasscodeReveal {...revealed} onDone={() => setRevealed(null)} />
      ) : null}

      {isPending || outlets.isPending ? <Loading /> : null}
      {error ? <Notice>{errorMessage(error)}</Notice> : null}
      {outlets.error ? <Notice>{errorMessage(outlets.error)}</Notice> : null}
      {vendors?.length === 0 ? <EmptyState>No vendors yet. Add one above.</EmptyState> : null}
      <div className="grid gap-space-md lg:grid-cols-2">
        {vendors?.map((vendor) => (
          <VendorCard
            key={vendor.phone}
            vendor={vendor}
            outlets={outlets.data ?? []}
            revealed={revealed?.phone === vendor.phone ? revealed : null}
            onPasscodeSet={setRevealed}
          />
        ))}
      </div>
    </div>
  );
}

function AddVendorForm({
  outlets,
  existingPhones,
  onPasscodeSet,
}: {
  outlets: Outlet[];
  existingPhones: string[];
  onPasscodeSet: (r: Revealed) => void;
}) {
  const assign = useAssignOutlet();
  const setPasscode = useSetPasscode();
  const [phoneInput, setPhoneInput] = useState('');
  const [label, setLabel] = useState('');
  const [outletId, setOutletId] = useState('');
  const [passcode, setPasscodeValue] = useState(() => generatePasscode());
  const [problems, setProblems] = useState<{ phone?: string; outlet?: string; passcode?: string }>({});

  const error = assign.error ?? setPasscode.error;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const phone = toIndianE164(phoneInput);
    const found = {
      phone: !phone
        ? 'Enter a 10-digit Indian mobile number.'
        : existingPhones.includes(phone)
          ? 'Already a vendor: use Assign outlet or Reset passcode on their card below.'
          : undefined,
      outlet: outletId ? undefined : 'Pick the outlet they run.',
      passcode: passcodeProblem(passcode) ?? undefined,
    };
    setProblems(found);
    if (!phone || found.phone || found.outlet || found.passcode) return;

    try {
      await assign.mutateAsync({ phone, outlet_id: outletId, label: label.trim() || null });
      await setPasscode.mutateAsync({ phone, passcode });
    } catch {
      return; // shown below; a vendor added without a passcode can get one from its card
    }
    onPasscodeSet({ phone, passcode });
    setPhoneInput('');
    setLabel('');
    setOutletId('');
    setPasscodeValue(generatePasscode());
  }

  return (
    <Card>
      <h2 className="mb-space-md font-serif text-headline-sm font-medium">Add a vendor</h2>
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <div className="grid gap-space-md sm:grid-cols-3">
          <TextField
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="98765 43210"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            error={problems.phone}
          />
          <TextField
            label="Name (optional)"
            autoComplete="off"
            placeholder="e.g. Amul counter owner"
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="flex flex-col gap-space-xs">
            <OutletSelect outlets={outlets} value={outletId} onChange={(e) => setOutletId(e.target.value)} />
            {problems.outlet ? <p className="text-body-sm text-error">{problems.outlet}</p> : null}
          </div>
        </div>
        <div className="flex flex-col gap-space-md sm:flex-row sm:items-start sm:justify-between">
          <PasscodeField value={passcode} onChange={setPasscodeValue} error={problems.passcode} />
          <Button
            type="submit"
            variant="primary"
            loading={assign.isPending || setPasscode.isPending}
            icon={<Plus className="size-4" aria-hidden />}
            className="sm:mt-6">
            Add vendor
          </Button>
        </div>
        {error ? <Notice>{errorMessage(error)}</Notice> : null}
      </form>
    </Card>
  );
}

function VendorCard({
  vendor,
  outlets,
  revealed,
  onPasscodeSet,
}: {
  vendor: Vendor;
  outlets: Outlet[];
  revealed: Revealed | null;
  onPasscodeSet: (r: Revealed | null) => void;
}) {
  const account = vendor.account;
  const hasPasscode = Boolean(account?.passcode_set_at);

  return (
    <Card className="flex flex-col gap-space-md">
      <div className="flex flex-wrap items-start justify-between gap-space-sm">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-space-sm font-serif text-headline-sm font-medium">
            <Phone className="size-4 text-on-surface-variant" aria-hidden />
            {formatPhone(vendor.phone)}
          </span>
          {vendor.label ? <span className="text-body-sm text-on-surface-variant">{vendor.label}</span> : null}
        </div>
        {hasPasscode ? (
          <Pill tone="open">Passcode set</Pill>
        ) : (
          <Pill tone="warning">No passcode · can't sign in</Pill>
        )}
      </div>

      <p className="text-body-sm text-on-surface-variant">
        {account?.passcode_set_at ? `Passcode set ${formatDateTime(account.passcode_set_at)}. ` : null}
        {account?.last_sign_in_at
          ? `Last signed in ${formatDateTime(account.last_sign_in_at)}.`
          : 'Has never signed in.'}
      </p>

      <OutletList vendor={vendor} outlets={outlets} />

      {revealed ? (
        <PasscodeReveal {...revealed} onDone={() => onPasscodeSet(null)} />
      ) : (
        <PasscodeEditor phone={vendor.phone} hasPasscode={hasPasscode} onSaved={onPasscodeSet} />
      )}
    </Card>
  );
}

function OutletList({ vendor, outlets }: { vendor: Vendor; outlets: Outlet[] }) {
  const assign = useAssignOutlet();
  const unassign = useUnassignOutlet();
  const [adding, setAdding] = useState(false);
  const [outletId, setOutletId] = useState('');
  const last = vendor.outlets.length === 1;

  return (
    <div className="flex flex-col gap-space-sm">
      <h3 className="font-label text-label-md uppercase text-on-surface-variant">Runs</h3>
      <ul className="flex flex-col gap-space-xs">
        {vendor.outlets.map((outlet) => (
          <li
            key={outlet.entryId}
            className="flex items-center justify-between gap-space-sm rounded-xl bg-surface-container-low py-1 pl-3 pr-1">
            <span className="flex min-w-0 items-center gap-space-sm">
              <Store className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
              <span className="truncate">{outlet.name}</span>
            </span>
            <ConfirmButton
              label="Unassign"
              confirmLabel={last ? 'Remove vendor' : 'Unassign'}
              icon={<X className="size-4" aria-hidden />}
              loading={unassign.isPending && unassign.variables === outlet.entryId}
              onConfirm={() => unassign.mutate(outlet.entryId)}
            />
          </li>
        ))}
      </ul>
      {last ? (
        <p className="text-body-sm text-on-surface-variant">
          Unassigning the last outlet removes this vendor's access.
        </p>
      ) : null}
      {unassign.error ? <Notice>{errorMessage(unassign.error)}</Notice> : null}

      {adding ? (
        <form
          className="flex flex-col gap-space-sm sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!outletId) return;
            assign.mutate(
              { phone: vendor.phone, outlet_id: outletId, label: vendor.label },
              {
                onSuccess: () => {
                  setAdding(false);
                  setOutletId('');
                },
              },
            );
          }}>
          <OutletSelect
            label="Assign another outlet"
            outlets={outlets}
            exclude={vendor.outlets.map((o) => o.outletId)}
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-space-xs">
            <Button type="submit" variant="primary" size="sm" loading={assign.isPending} disabled={!outletId}>
              Assign
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => setAdding(true)}>
          Assign outlet
        </Button>
      )}
      {assign.error ? <Notice>{errorMessage(assign.error)}</Notice> : null}
    </div>
  );
}

function PasscodeEditor({
  phone,
  hasPasscode,
  onSaved,
}: {
  phone: string;
  hasPasscode: boolean;
  onSaved: (r: Revealed) => void;
}) {
  const setPasscode = useSetPasscode();
  const [open, setOpen] = useState(false);
  const [passcode, setValue] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  if (!open) {
    return (
      <Button
        size="sm"
        className="self-start"
        icon={<KeyRound className="size-4" aria-hidden />}
        onClick={() => {
          setValue(generatePasscode());
          setOpen(true);
        }}>
        {hasPasscode ? 'Reset passcode' : 'Set passcode'}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low p-space-md"
      onSubmit={(event) => {
        event.preventDefault();
        const found = passcodeProblem(passcode);
        setProblem(found);
        if (found) return;
        setPasscode.mutate(
          { phone, passcode },
          {
            onSuccess: () => {
              setOpen(false);
              onSaved({ phone, passcode });
            },
          },
        );
      }}>
      {hasPasscode ? (
        <p className="text-body-sm text-on-surface-variant">
          The old passcode stops working as soon as you save. Devices already signed in stay signed in.
        </p>
      ) : null}
      <div className="flex flex-col gap-space-sm sm:flex-row sm:items-start sm:justify-between">
        <PasscodeField
          value={passcode}
          onChange={(next) => {
            setValue(next);
            setProblem(null);
          }}
          error={problem ?? (setPasscode.error ? errorMessage(setPasscode.error) : null)}
        />
        <div className="flex gap-space-xs sm:mt-6">
          <Button type="submit" variant="primary" size="sm" loading={setPasscode.isPending}>
            Save passcode
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

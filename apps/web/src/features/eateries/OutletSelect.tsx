import type { SelectHTMLAttributes } from 'react';

import { SelectField } from '@/components/ui';
import type { Outlet, OutletType } from '@/features/eateries/queries';

const GROUPS: { label: string; types: OutletType[] }[] = [
  { label: 'Campus eateries', types: ['eatery'] },
  { label: 'Hostel canteens', types: ['day_canteen', 'night_canteen'] },
  { label: 'Messes', types: ['mess'] },
];

/** Outlet picker, eateries first; `exclude` hides outlets the vendor already runs. */
export function OutletSelect({
  outlets,
  exclude = [],
  label = 'Outlet',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { outlets: Outlet[]; exclude?: string[]; label?: string }) {
  return (
    <SelectField label={label} {...props}>
      <option value="" disabled>
        Choose an outlet…
      </option>
      {GROUPS.map((group) => {
        const options = outlets.filter((o) => group.types.includes(o.type) && !exclude.includes(o.id));
        return options.length ? (
          <optgroup key={group.label} label={group.label}>
            {options.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </SelectField>
  );
}

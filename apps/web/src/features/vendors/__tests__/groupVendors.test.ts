import { describe, expect, it } from 'vitest';

import { groupVendors, type WhitelistEntry } from '@/features/vendors/queries';

function entry(overrides: Partial<WhitelistEntry>): WhitelistEntry {
  return {
    id: 'e1',
    phone_e164: '+919510709195',
    outlet_id: 'amul',
    outlet_name: 'Amul',
    label: null,
    active: true,
    created_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupVendors', () => {
  it('groups outlets by phone, newest vendor first, outlets by name', () => {
    const vendors = groupVendors(
      [
        entry({ id: 'e1', outlet_id: 'amul', outlet_name: 'Amul' }),
        entry({ id: 'e2', outlet_id: 'ccd', outlet_name: 'Cafe Coffee Day', label: 'Owner' }),
        entry({ id: 'e3', phone_e164: '+919000000001', created_at: '2026-10-05T00:00:00Z' }),
      ],
      [{ phone_e164: '+919510709195', has_account: true, passcode_set_at: '2026-10-02T00:00:00Z', last_sign_in_at: null }],
    );

    expect(vendors.map((v) => v.phone)).toEqual(['+919000000001', '+919510709195']);
    const owner = vendors[1]!;
    expect(owner.label).toBe('Owner');
    expect(owner.outlets.map((o) => o.name)).toEqual(['Amul', 'Cafe Coffee Day']);
    expect(owner.account?.passcode_set_at).toBe('2026-10-02T00:00:00Z');
    expect(vendors[0]!.account).toBeNull();
  });
});

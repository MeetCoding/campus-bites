import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

/** GET /v1/admin/vendor-whitelist: one row per phone ↔ outlet link. */
export type WhitelistEntry = {
  id: string;
  phone_e164: string;
  outlet_id: string;
  outlet_name: string | null;
  label: string | null;
  active: boolean;
  created_at: string;
};

/** GET /v1/admin/vendor-accounts: one row per whitelisted phone. */
export type VendorAccount = {
  phone_e164: string;
  has_account: boolean;
  /** Runs every mess, canteen and eatery, including ones added later. */
  is_master: boolean;
  passcode_set_at: string | null;
  last_sign_in_at: string | null;
};

export type Vendor = {
  phone: string;
  label: string | null;
  outlets: { entryId: string; outletId: string; name: string }[];
  account: VendorAccount | null;
};

export const vendorKeys = {
  whitelist: ['vendors', 'whitelist'] as const,
  accounts: ['vendors', 'accounts'] as const,
};

/** Groups whitelist rows by phone (one vendor may run many outlets), newest vendors first. */
export function groupVendors(entries: WhitelistEntry[], accounts: VendorAccount[]): Vendor[] {
  const byPhone = new Map<string, Vendor & { since: string }>();
  for (const entry of entries) {
    const vendor = byPhone.get(entry.phone_e164) ?? {
      phone: entry.phone_e164,
      label: null,
      outlets: [],
      account: accounts.find((a) => a.phone_e164 === entry.phone_e164) ?? null,
      since: entry.created_at,
    };
    vendor.label ??= entry.label;
    if (entry.created_at < vendor.since) vendor.since = entry.created_at;
    vendor.outlets.push({
      entryId: entry.id,
      outletId: entry.outlet_id,
      name: entry.outlet_name ?? 'Unknown outlet',
    });
    byPhone.set(entry.phone_e164, vendor);
  }
  return [...byPhone.values()]
    .sort((a, b) => b.since.localeCompare(a.since))
    .map(({ since: _since, ...vendor }) => ({
      ...vendor,
      outlets: vendor.outlets.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function useVendors() {
  const whitelist = useQuery({
    queryKey: vendorKeys.whitelist,
    queryFn: () => api<WhitelistEntry[]>('/v1/admin/vendor-whitelist'),
  });
  const accounts = useQuery({
    queryKey: vendorKeys.accounts,
    queryFn: () => api<VendorAccount[]>('/v1/admin/vendor-accounts'),
  });
  return {
    vendors: whitelist.data && accounts.data ? groupVendors(whitelist.data, accounts.data) : undefined,
    entries: whitelist.data,
    isPending: whitelist.isPending || accounts.isPending,
    error: whitelist.error ?? accounts.error,
  };
}

function useInvalidateVendors() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['vendors'] });
}

export function useAssignOutlet() {
  const invalidate = useInvalidateVendors();
  return useMutation({
    mutationFn: (body: { phone: string; outlet_id: string; label?: string | null }) =>
      api<WhitelistEntry>('/v1/admin/vendor-whitelist', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUnassignOutlet() {
  const invalidate = useInvalidateVendors();
  return useMutation({
    mutationFn: (entryId: string) => api<void>(`/v1/admin/vendor-whitelist/${entryId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSetPasscode() {
  const invalidate = useInvalidateVendors();
  return useMutation({
    mutationFn: (body: { phone: string; passcode: string }) =>
      api<VendorAccount>('/v1/admin/vendor-accounts/passcode', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

/** Whitelists the phone for every outlet (and every future one). Returns how many it now runs. */
export function useMakeMasterVendor() {
  const invalidate = useInvalidateVendors();
  return useMutation({
    mutationFn: (body: { phone: string; label?: string | null }) =>
      api<{ phone_e164: string; outlets_linked: number }>('/v1/admin/master-vendors', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

/** Stops auto-assigning new outlets; the vendor keeps the outlets they run now. */
export function useRemoveMasterVendor() {
  const invalidate = useInvalidateVendors();
  return useMutation({
    mutationFn: (phone: string) =>
      api<void>(`/v1/admin/master-vendors/${encodeURIComponent(phone)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Removes every outlet link and the vendor's sign-in account. */
export function useDeleteVendor() {
  const invalidate = useInvalidateVendors();
  return useMutation({
    mutationFn: (phone: string) => api<void>(`/v1/admin/vendors/${encodeURIComponent(phone)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

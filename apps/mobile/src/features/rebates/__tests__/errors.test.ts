import { describe, expect, it, jest } from '@jest/globals';

import { rebateErrorMessage } from '@/features/rebates/errors';
import { ApiError } from '@/lib/api';

// lib/api imports the Supabase client, which needs native modules; the mapper only needs ApiError.
// (babel-jest hoists jest.mock above the imports.)
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('rebateErrorMessage', () => {
  it('maps stable codes to friendly copy', () => {
    expect(rebateErrorMessage(new ApiError(409, 'REBATE_OVERLAP', 'These dates overlap…'))).toMatch(
      /already have a rebate covering/,
    );
    expect(rebateErrorMessage(new ApiError(0, 'NETWORK', 'Could not reach'))).toMatch(/Nothing was sent/);
    expect(rebateErrorMessage(new ApiError(422, 'REMARKS_REQUIRED', 'x'))).toMatch(/Add remarks/);
  });

  it('keeps server wording when it carries live settings', () => {
    const tooShort = new ApiError(422, 'REBATE_TOO_SHORT', 'A rebate must cover at least 3 consecutive days.');
    expect(rebateErrorMessage(tooShort)).toBe('A rebate must cover at least 3 consecutive days.');
  });

  it('falls back to the server message, then the error message', () => {
    expect(rebateErrorMessage(new ApiError(500, 'SOMETHING_NEW', 'Server said so'))).toBe('Server said so');
    expect(rebateErrorMessage(new Error('PDFs must be 5 MB or smaller.'))).toBe('PDFs must be 5 MB or smaller.');
    expect(rebateErrorMessage('???')).toBe('Something went wrong. Try again.');
  });
});

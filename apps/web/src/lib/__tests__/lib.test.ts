import { describe, expect, it } from 'vitest';

import { toApiError } from '@/lib/api';
import { formatPhone, toIndianE164 } from '@/lib/format';
import { isAdminToken } from '@/lib/jwt';
import { generatePasscode, passcodeProblem } from '@/lib/passcode';

function token(claims: object): string {
  const body = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${body}.signature`;
}

describe('isAdminToken', () => {
  it('accepts tokens whose roles include admin', () => {
    expect(isAdminToken(token({ roles: ['student', 'admin'] }))).toBe(true);
  });

  it('rejects students, missing roles and garbage', () => {
    expect(isAdminToken(token({ roles: ['student'] }))).toBe(false);
    expect(isAdminToken(token({ email: 'a@iitr.ac.in' }))).toBe(false);
    expect(isAdminToken('not-a-jwt')).toBe(false);
  });
});

describe('phones', () => {
  it('normalises Indian mobiles', () => {
    expect(toIndianE164('095107 09195')).toBe('+919510709195');
    expect(toIndianE164('+91-95107-09195')).toBe('+919510709195');
    expect(toIndianE164('12345')).toBeNull();
    expect(toIndianE164('5510709195')).toBeNull();
  });

  it('formats +91 numbers for display', () => {
    expect(formatPhone('+919510709195')).toBe('+91 95107 09195');
    expect(formatPhone('+14155550100')).toBe('+14155550100');
  });
});

describe('passcodes', () => {
  it('matches the API rules', () => {
    expect(passcodeProblem('482915')).toBeNull();
    expect(passcodeProblem('12345')).not.toBeNull();
    expect(passcodeProblem('12a456')).not.toBeNull();
    expect(passcodeProblem('000000')).not.toBeNull();
    expect(passcodeProblem('123456')).not.toBeNull();
  });

  it('generates only acceptable codes', () => {
    for (let i = 0; i < 200; i++) {
      expect(passcodeProblem(generatePasscode())).toBeNull();
    }
  });

  it('skips weak codes from the random source', () => {
    const digits = [1, 1, 1, 1, 1, 1, 4, 8, 2, 9, 1, 5];
    expect(generatePasscode(() => digits.shift()!)).toBe('482915');
  });
});

describe('toApiError', () => {
  it('surfaces stable codes and validation messages', () => {
    expect(toApiError(409, { detail: { code: 'ADMIN_DUPLICATE', message: 'Already' } })).toMatchObject({
      code: 'ADMIN_DUPLICATE',
      message: 'Already',
    });
    expect(toApiError(422, { detail: [{ msg: 'Value error, Must be an @iitr.ac.in email address.' }] }).message).toBe(
      'Must be an @iitr.ac.in email address.',
    );
  });
});

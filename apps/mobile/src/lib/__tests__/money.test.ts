import { describe, expect, it } from '@jest/globals';

import { formatPaise, parseRupeesToPaise } from '@/lib/money';

describe('money', () => {
  it('formats paise as rupees', () => {
    expect(formatPaise(4000)).toBe('₹40');
    expect(formatPaise(4050)).toBe('₹40.50');
    expect(formatPaise(0)).toBe('₹0');
  });

  it('parses rupee input to paise', () => {
    expect(parseRupeesToPaise('40')).toBe(4000);
    expect(parseRupeesToPaise('₹ 40.5')).toBe(4050);
    expect(parseRupeesToPaise('1,200')).toBe(120000);
    expect(parseRupeesToPaise('40.555')).toBeNull();
    expect(parseRupeesToPaise('-5')).toBeNull();
    expect(parseRupeesToPaise('')).toBeNull();
  });
});

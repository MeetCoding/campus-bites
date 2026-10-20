// Mirrors VendorPasscodeSet in apps/api/app/schemas/admin.py: exactly 6 digits, not guessable.
const WEAK = new Set(['123456', '654321', '012345', '123123', '121212', '112233']);

/** Why the passcode would be refused, or null when it is fine. */
export function passcodeProblem(passcode: string): string | null {
  if (!/^\d{6}$/.test(passcode)) return 'Use exactly 6 digits.';
  if (new Set(passcode).size === 1 || WEAK.has(passcode)) return 'That passcode is too easy to guess.';
  return null;
}

/** A random acceptable 6-digit passcode (crypto RNG). */
export function generatePasscode(random: () => number = secureDigit): string {
  for (;;) {
    const code = Array.from({ length: 6 }, () => String(random())).join('');
    if (passcodeProblem(code) === null) return code;
  }
}

function secureDigit(): number {
  // Rejection sampling keeps the digits uniform (256 isn't a multiple of 10).
  const byte = new Uint8Array(1);
  do crypto.getRandomValues(byte);
  while (byte[0]! >= 250);
  return byte[0]! % 10;
}

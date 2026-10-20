/** Accepts a 10-digit Indian mobile (spaces/dashes, +91 or 0 prefix allowed) → +91XXXXXXXXXX. */
export function toIndianE164(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** +919510709195 → "+91 95107 09195"; other numbers unchanged. */
export function formatPhone(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}

const dateTime = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});

/** Timestamps are shown in IST, like everywhere else in Campus Bites. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

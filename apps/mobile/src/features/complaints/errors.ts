import { ApiError } from '@/lib/api';

/** Friendly copy for the API's complaint error codes (apps/api/app/services/complaints.py). */
const COPY: Record<string, string> = {
  FORBIDDEN: "You can't act on this complaint.",
  ONLY_COMPLAINANT: 'Only the student who raised it can do that.',
  ONLY_HANDLER: 'Only the assigned secretary or ADoSW can do that.',
  ILLEGAL_TRANSITION: 'This complaint has moved on — it has been refreshed.',
  COMPLAINT_STALE: 'Someone else just updated this complaint. It has been refreshed.',
  COMPLAINT_NOT_FOUND: 'This complaint no longer exists.',
  MESSAGE_REQUIRED: 'Write a short reply about what is being done.',
  BAD_ATTACHMENT: "The photo didn't upload properly. Attach it again.",
  COMPLAINT_RESOLVED: 'This complaint is already resolved.',
  NETWORK: "Couldn't reach Campus Bites. Nothing was sent — try again.",
  NOT_AUTHENTICATED: 'Your session ended. Sign in again.',
  TOKEN_EXPIRED: 'Your session ended. Sign in again.',
};

/** Codes whose server message carries live values ("in 4 h", "7 days"). */
const SERVER_WORDED = new Set(['NUDGE_TOO_EARLY', 'NUDGE_COOLDOWN', 'VALIDATION_ERROR']);

export function complaintErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (SERVER_WORDED.has(error.code)) return error.message;
    return COPY[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Try again.';
}

import { ApiError } from '@/lib/api';

/** Friendly copy for the API's stable error codes (apps/api/app/services/rebates.py). */
const COPY: Record<string, string> = {
  REBATE_OVERLAP: 'You already have a rebate covering some of these dates — check your applications below.',
  REBATE_NO_BHAWAN: 'Choose your Bhawan first, then apply.',
  REBATE_INVALID_RANGE: 'The end date must be on or after the start date.',
  REBATE_BAD_DOCUMENT: "The document didn't upload properly. Attach it again and resubmit.",
  STUDENTS_ONLY: 'Only students can apply for a mess rebate.',
  REMARKS_REQUIRED: 'Add remarks so the student knows why it was rejected.',
  ILLEGAL_TRANSITION: 'This application has already moved on — refresh to see its current status.',
  REBATE_STALE: 'Someone else just updated this application. It has been refreshed.',
  REBATE_NOT_FOUND: 'This application no longer exists.',
  NETWORK: "Couldn't reach Campus Bites. Nothing was sent — try again.",
  NOT_AUTHENTICATED: 'Your session ended. Sign in again.',
  TOKEN_EXPIRED: 'Your session ended. Sign in again.',
};

/**
 * Codes whose server message carries live values (e.g. "at least 3 consecutive days" from
 * app_settings), so the message is shown as-is.
 */
const SERVER_WORDED = new Set(['REBATE_TOO_SHORT', 'REBATE_TOO_LONG', 'REBATE_PAST_DATE', 'VALIDATION_ERROR']);

export function rebateErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (SERVER_WORDED.has(error.code)) return error.message;
    return COPY[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Try again.';
}

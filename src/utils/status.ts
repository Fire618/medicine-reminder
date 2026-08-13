import type { ReminderStatus, VerificationStatus } from '../db/types';

export const STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: 'Pending',
  taken: 'Taken',
  skipped: 'Skipped',
  snoozed: 'Snoozed',
  dismissed: 'Dismissed',
  missed: 'Missed',
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  none: 'Manual',
  match: 'Visual match',
  'no-match': 'No match',
};

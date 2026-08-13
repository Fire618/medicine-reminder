export type Frequency = 'daily' | 'custom-days';

export type VisualMetadata = {
  /** Average RGB color of the medicine (foreground). */
  dominantColor: [number, number, number];
  /** Normalized 4x4x4 RGB histogram of the foreground (64 buckets). */
  colorHistogram: number[];
  /** Foreground area / total image area (0..1). */
  sizeRatio: number;
  /** Width / height of the foreground bounding box. */
  aspectRatio: number;
  /** 8x8 silhouette grid, each cell 0..1 foreground fraction (64 values). */
  grid: number[];
  /** 64-bit dHash as 16 hex characters. */
  hash: string;
};

export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  frequency: Frequency;
  /** 0=Sunday ... 6=Saturday. Empty when frequency is 'daily'. */
  daysOfWeek: number[];
  /** Reminder times as 24h "HH:mm". */
  times: string[];
  /** Local date "YYYY-MM-DD". */
  startDate: string;
  /** Inclusive end date "YYYY-MM-DD", or null when ongoing. */
  endDate: string | null;
  durationDays: number | null;
  referenceImage: Blob | null;
  visualMetadata: VisualMetadata | null;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type MedicineInput = Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>;

export type ReminderStatus =
  | 'pending'
  | 'taken'
  | 'skipped'
  | 'snoozed'
  | 'dismissed'
  | 'missed';

export type VerificationStatus = 'none' | 'match' | 'no-match';

export type Reminder = {
  id: string;
  medicineId: string;
  /** Epoch ms of the scheduled moment. */
  scheduledTime: number;
  status: ReminderStatus;
  triggeredAt: number | null;
  completedAt: number | null;
  action: string | null;
  verificationResult: VerificationStatus | null;
};

export type HistoryEntry = {
  id: string;
  medicineId: string;
  medicineName: string;
  scheduledTime: number;
  completedAt: number | null;
  status: ReminderStatus;
  verificationStatus: VerificationStatus;
  action: string | null;
};

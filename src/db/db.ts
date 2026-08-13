import Dexie, { type Table } from 'dexie';
import type { HistoryEntry, Medicine, Reminder } from './types';

class MedicineDatabase extends Dexie {
  medicines!: Table<Medicine, string>;
  reminders!: Table<Reminder, string>;
  history!: Table<HistoryEntry, string>;

  constructor() {
    super('medicine-reminder');
    this.version(1).stores({
      medicines: 'id, name, active, updatedAt',
      reminders: 'id, medicineId, scheduledTime, status, [medicineId+scheduledTime]',
      history: 'id, medicineId, scheduledTime, status, [medicineId+scheduledTime]',
    });
  }
}

export const db = new MedicineDatabase();

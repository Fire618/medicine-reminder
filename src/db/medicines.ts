import { db } from './db';
import type { Medicine, MedicineInput } from './types';
import { newId } from '../utils/id';

export async function listMedicines(): Promise<Medicine[]> {
  return db.medicines.orderBy('updatedAt').reverse().toArray();
}

export async function getMedicine(id: string): Promise<Medicine | undefined> {
  return db.medicines.get(id);
}

export async function createMedicine(input: MedicineInput): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.medicines.add({ ...input, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateMedicine(
  id: string,
  input: Partial<MedicineInput>,
): Promise<void> {
  await db.medicines.update(id, { ...input, updatedAt: Date.now() });
}

/**
 * Deletes a medicine together with its reminders and medication history.
 * This is intentional: after deletion there is nothing sensible to attach
 * those records to, and the app keeps no other personal information.
 */
export async function deleteMedicine(id: string): Promise<void> {
  await db.transaction('rw', db.medicines, db.reminders, db.history, async () => {
    await db.medicines.delete(id);
    await db.reminders.where('medicineId').equals(id).delete();
    await db.history.where('medicineId').equals(id).delete();
  });
}

export async function setMedicineActive(id: string, active: boolean): Promise<void> {
  await db.medicines.update(id, { active, updatedAt: Date.now() });
}

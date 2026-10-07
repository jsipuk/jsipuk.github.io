import { exportBackup, importBackup } from './collection.js';
export const STORAGE_KEY = 'cardledger-alpha-v1';
export function loadCollection(storage, initial) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
    return { state: raw === null ? initial : importBackup(raw), error: null, raw };
  } catch (error) {
    // Never overwrite a corrupt or newer backup with an empty collection.
    return { state: initial, error: error.message, raw };
  }
}
export function saveCollection(storage, state) {
  storage.setItem(STORAGE_KEY, exportBackup(state));
}

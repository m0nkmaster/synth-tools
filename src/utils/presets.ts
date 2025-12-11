/**
 * Preset storage utilities for synthesizer configurations
 */

import type { SoundConfig } from '../types/soundConfig';

export interface Preset {
  id: string;
  name: string;
  category: string;
  config: SoundConfig;
  createdAt: number;
  updatedAt: number;
}

export interface PresetStorage {
  presets: Preset[];
  defaultPresetId: string;
}

const STORAGE_KEY = 'opDone.synth.presets';

/**
 * Storage error types
 */
export class PresetStorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PresetStorageError';
  }
}

export class QuotaExceededError extends PresetStorageError {
  constructor(cause?: unknown) {
    super('Storage quota exceeded. Consider deleting old presets.', cause);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get preset storage from localStorage
 */
function getStorage(): PresetStorage {
  if (!isLocalStorageAvailable()) {
    throw new PresetStorageError('localStorage is not available');
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return { presets: [], defaultPresetId: '' };
    }
    return JSON.parse(data) as PresetStorage;
  } catch (error) {
    throw new PresetStorageError('Failed to read preset storage', error);
  }
}

/**
 * Save preset storage to localStorage
 */
function setStorage(storage: PresetStorage): void {
  if (!isLocalStorageAvailable()) {
    throw new PresetStorageError('localStorage is not available');
  }

  try {
    const data = JSON.stringify(storage);
    localStorage.setItem(STORAGE_KEY, data);
  } catch (error) {
    // Check if it's a quota exceeded error
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new QuotaExceededError(error);
    }
    throw new PresetStorageError('Failed to write preset storage', error);
  }
}

/**
 * Generate a unique ID for a preset
 */
function generateId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Save a preset to storage
 */
export function savePreset(name: string, config: SoundConfig): Preset {
  const storage = getStorage();
  const now = Date.now();

  const preset: Preset = {
    id: generateId(),
    name,
    category: config.metadata.category,
    config,
    createdAt: now,
    updatedAt: now,
  };

  storage.presets.push(preset);
  setStorage(storage);

  return preset;
}

/**
 * Update an existing preset
 */
export function updatePreset(id: string, config: SoundConfig): Preset {
  const storage = getStorage();
  const index = storage.presets.findIndex(p => p.id === id);

  if (index === -1) {
    throw new PresetStorageError(`Preset with id ${id} not found`);
  }

  const preset = storage.presets[index];
  preset.config = config;
  preset.category = config.metadata.category;
  preset.updatedAt = Date.now();

  storage.presets[index] = preset;
  setStorage(storage);

  return preset;
}

/**
 * Load a preset by ID
 */
export function loadPreset(id: string): Preset {
  const storage = getStorage();
  const preset = storage.presets.find(p => p.id === id);

  if (!preset) {
    throw new PresetStorageError(`Preset with id ${id} not found`);
  }

  return preset;
}

/**
 * Get all presets
 */
export function listPresets(): Preset[] {
  const storage = getStorage();
  return [...storage.presets];
}

/**
 * Delete a preset by ID
 */
export function deletePreset(id: string): void {
  const storage = getStorage();
  const index = storage.presets.findIndex(p => p.id === id);

  if (index === -1) {
    throw new PresetStorageError(`Preset with id ${id} not found`);
  }

  storage.presets.splice(index, 1);

  // Clear default if it was deleted
  if (storage.defaultPresetId === id) {
    storage.defaultPresetId = '';
  }

  setStorage(storage);
}

/**
 * Set the default preset
 */
export function setDefaultPreset(id: string): void {
  const storage = getStorage();
  const preset = storage.presets.find(p => p.id === id);

  if (!preset) {
    throw new PresetStorageError(`Preset with id ${id} not found`);
  }

  storage.defaultPresetId = id;
  setStorage(storage);
}

/**
 * Get the default preset
 */
export function getDefaultPreset(): Preset | null {
  const storage = getStorage();

  if (!storage.defaultPresetId) {
    return null;
  }

  const preset = storage.presets.find(p => p.id === storage.defaultPresetId);
  return preset || null;
}

/**
 * Clear all presets (use with caution)
 */
export function clearAllPresets(): void {
  if (!isLocalStorageAvailable()) {
    throw new PresetStorageError('localStorage is not available');
  }

  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Tests for preset storage utilities
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  savePreset,
  loadPreset,
  listPresets,
  deletePreset,
  updatePreset,
  setDefaultPreset,
  getDefaultPreset,
  clearAllPresets,
  PresetStorageError,
  QuotaExceededError,
} from './presets';
import { DEFAULT_SOUND_CONFIG } from '../types/soundConfig';
import type { SoundConfig } from '../types/soundConfig';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Replace global localStorage with mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Preset Storage Utilities', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('savePreset', () => {
    test('should save a preset with generated ID and timestamps', () => {
      const config: SoundConfig = {
        ...DEFAULT_SOUND_CONFIG,
        metadata: {
          ...DEFAULT_SOUND_CONFIG.metadata,
          name: 'Test Preset',
          category: 'bass',
        },
      };

      const preset = savePreset('Test Preset', config);

      expect(preset.id).toBeTruthy();
      expect(preset.name).toBe('Test Preset');
      expect(preset.category).toBe('bass');
      expect(preset.config).toEqual(config);
      expect(preset.createdAt).toBeGreaterThan(0);
      expect(preset.updatedAt).toBe(preset.createdAt);
    });

    test('should store preset in localStorage', () => {
      const config = DEFAULT_SOUND_CONFIG;
      savePreset('Test', config);

      const stored = localStorageMock.getItem('opDone.synth.presets');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.presets).toHaveLength(1);
      expect(parsed.presets[0].name).toBe('Test');
    });

    test('should handle multiple presets', () => {
      savePreset('Preset 1', DEFAULT_SOUND_CONFIG);
      savePreset('Preset 2', DEFAULT_SOUND_CONFIG);
      savePreset('Preset 3', DEFAULT_SOUND_CONFIG);

      const presets = listPresets();
      expect(presets).toHaveLength(3);
      expect(presets.map(p => p.name)).toEqual(['Preset 1', 'Preset 2', 'Preset 3']);
    });
  });

  describe('loadPreset', () => {
    test('should load a saved preset by ID', () => {
      const config = DEFAULT_SOUND_CONFIG;
      const saved = savePreset('Test', config);

      const loaded = loadPreset(saved.id);

      expect(loaded.id).toBe(saved.id);
      expect(loaded.name).toBe('Test');
      expect(loaded.config).toEqual(config);
    });

    test('should throw error for non-existent preset', () => {
      expect(() => loadPreset('non-existent-id')).toThrow(PresetStorageError);
      expect(() => loadPreset('non-existent-id')).toThrow('not found');
    });
  });

  describe('listPresets', () => {
    test('should return empty array when no presets exist', () => {
      const presets = listPresets();
      expect(presets).toEqual([]);
    });

    test('should return all saved presets', () => {
      savePreset('Preset 1', DEFAULT_SOUND_CONFIG);
      savePreset('Preset 2', DEFAULT_SOUND_CONFIG);

      const presets = listPresets();
      expect(presets).toHaveLength(2);
    });

    test('should return a copy of presets array', () => {
      savePreset('Test', DEFAULT_SOUND_CONFIG);

      const presets1 = listPresets();
      const presets2 = listPresets();

      expect(presets1).not.toBe(presets2);
      expect(presets1).toEqual(presets2);
    });
  });

  describe('deletePreset', () => {
    test('should delete a preset by ID', () => {
      const saved = savePreset('Test', DEFAULT_SOUND_CONFIG);

      deletePreset(saved.id);

      const presets = listPresets();
      expect(presets).toHaveLength(0);
    });

    test('should throw error for non-existent preset', () => {
      expect(() => deletePreset('non-existent-id')).toThrow(PresetStorageError);
      expect(() => deletePreset('non-existent-id')).toThrow('not found');
    });

    test('should clear default preset if deleted', () => {
      const saved = savePreset('Test', DEFAULT_SOUND_CONFIG);
      setDefaultPreset(saved.id);

      deletePreset(saved.id);

      const defaultPreset = getDefaultPreset();
      expect(defaultPreset).toBeNull();
    });

    test('should not affect other presets', () => {
      const preset1 = savePreset('Preset 1', DEFAULT_SOUND_CONFIG);
      const preset2 = savePreset('Preset 2', DEFAULT_SOUND_CONFIG);
      const preset3 = savePreset('Preset 3', DEFAULT_SOUND_CONFIG);

      deletePreset(preset2.id);

      const presets = listPresets();
      expect(presets).toHaveLength(2);
      expect(presets.map(p => p.id)).toEqual([preset1.id, preset3.id]);
    });
  });

  describe('updatePreset', () => {
    test('should update an existing preset', () => {
      const saved = savePreset('Original', DEFAULT_SOUND_CONFIG);

      const newConfig: SoundConfig = {
        ...DEFAULT_SOUND_CONFIG,
        metadata: {
          ...DEFAULT_SOUND_CONFIG.metadata,
          name: 'Updated',
          category: 'lead',
        },
      };

      const updated = updatePreset(saved.id, newConfig);

      expect(updated.id).toBe(saved.id);
      expect(updated.config.metadata.name).toBe('Updated');
      expect(updated.category).toBe('lead');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(saved.updatedAt);
      expect(updated.createdAt).toBe(saved.createdAt);
    });

    test('should throw error for non-existent preset', () => {
      expect(() => updatePreset('non-existent-id', DEFAULT_SOUND_CONFIG)).toThrow(PresetStorageError);
      expect(() => updatePreset('non-existent-id', DEFAULT_SOUND_CONFIG)).toThrow('not found');
    });
  });

  describe('setDefaultPreset and getDefaultPreset', () => {
    test('should set and get default preset', () => {
      const saved = savePreset('Test', DEFAULT_SOUND_CONFIG);

      setDefaultPreset(saved.id);

      const defaultPreset = getDefaultPreset();
      expect(defaultPreset).not.toBeNull();
      expect(defaultPreset?.id).toBe(saved.id);
    });

    test('should return null when no default preset is set', () => {
      const defaultPreset = getDefaultPreset();
      expect(defaultPreset).toBeNull();
    });

    test('should throw error when setting non-existent preset as default', () => {
      expect(() => setDefaultPreset('non-existent-id')).toThrow(PresetStorageError);
      expect(() => setDefaultPreset('non-existent-id')).toThrow('not found');
    });

    test('should return null if default preset was deleted', () => {
      const saved = savePreset('Test', DEFAULT_SOUND_CONFIG);
      setDefaultPreset(saved.id);

      // Manually delete from storage without using deletePreset
      const storage = JSON.parse(localStorageMock.getItem('opDone.synth.presets')!);
      storage.presets = [];
      localStorageMock.setItem('opDone.synth.presets', JSON.stringify(storage));

      const defaultPreset = getDefaultPreset();
      expect(defaultPreset).toBeNull();
    });
  });

  describe('clearAllPresets', () => {
    test('should clear all presets from storage', () => {
      savePreset('Preset 1', DEFAULT_SOUND_CONFIG);
      savePreset('Preset 2', DEFAULT_SOUND_CONFIG);

      clearAllPresets();

      const presets = listPresets();
      expect(presets).toHaveLength(0);
    });

    test('should allow saving new presets after clearing', () => {
      savePreset('Old', DEFAULT_SOUND_CONFIG);
      clearAllPresets();

      const saved = savePreset('New', DEFAULT_SOUND_CONFIG);
      const presets = listPresets();

      expect(presets).toHaveLength(1);
      expect(presets[0].id).toBe(saved.id);
    });
  });

  describe('Error Handling', () => {
    test('should handle quota exceeded error', () => {
      // Save a preset first to ensure storage exists
      savePreset('Initial', DEFAULT_SOUND_CONFIG);

      // Mock setItem to throw quota exceeded error only for the storage key
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = (key: string, value: string) => {
        if (key === 'opDone.synth.presets') {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        }
        originalSetItem(key, value);
      };

      expect(() => savePreset('Test', DEFAULT_SOUND_CONFIG)).toThrow(QuotaExceededError);
      expect(() => savePreset('Test', DEFAULT_SOUND_CONFIG)).toThrow('quota exceeded');

      // Restore original
      localStorageMock.setItem = originalSetItem;
    });

    test('should handle corrupted storage data', () => {
      // Set invalid JSON in storage using the original setItem
      const originalSetItem = localStorageMock.setItem;
      originalSetItem('opDone.synth.presets', 'invalid json');

      expect(() => listPresets()).toThrow(PresetStorageError);
      expect(() => listPresets()).toThrow('Failed to read');
    });

    test('should handle unavailable localStorage', () => {
      // Mock localStorage to be unavailable
      const originalLocalStorage = global.localStorage;
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true,
      });

      expect(() => savePreset('Test', DEFAULT_SOUND_CONFIG)).toThrow(PresetStorageError);
      expect(() => savePreset('Test', DEFAULT_SOUND_CONFIG)).toThrow('not available');

      // Restore original
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
      });
    });
  });

  /**
   * Feature: synth-ui, Property 4: Preset Round-Trip
   * For any valid sound configuration, saving it as a preset and then loading 
   * that preset should restore the exact same configuration.
   * Validates: Requirements 8.2
   */
  describe('Property-Based Tests', () => {
    test('Property 4: Preset Round-Trip', () => {
      // Helper to create valid float generator that avoids NaN
      const validFloat = (min: number, max: number) => 
        fc.float({ min: Math.fround(min), max: Math.fround(max), noNaN: true });

      fc.assert(
        fc.property(
          fc.record({
            synthesis: fc.record({
              layers: fc.array(
                fc.record({
                  type: fc.constantFrom('oscillator', 'noise', 'fm', 'karplus-strong'),
                  gain: validFloat(0, 1),
                  oscillator: fc.option(fc.record({
                    waveform: fc.constantFrom('sine', 'square', 'sawtooth', 'triangle'),
                    frequency: validFloat(20, 20000),
                    detune: validFloat(-100, 100),
                  }), { nil: undefined }),
                  noise: fc.option(fc.record({
                    type: fc.constantFrom('white', 'pink', 'brown'),
                  }), { nil: undefined }),
                  fm: fc.option(fc.record({
                    carrier: validFloat(20, 20000),
                    modulator: validFloat(20, 20000),
                    modulationIndex: validFloat(0, 1000),
                  }), { nil: undefined }),
                  karplus: fc.option(fc.record({
                    frequency: validFloat(20, 2000),
                    damping: validFloat(0, 1),
                  }), { nil: undefined }),
                }),
                { minLength: 1, maxLength: 8 }
              ),
            }),
            envelope: fc.record({
              attack: validFloat(0.001, 5),
              decay: validFloat(0.001, 5),
              sustain: validFloat(0, 1),
              release: validFloat(0.001, 10),
            }),
            effects: fc.record({}),
            timing: fc.record({
              duration: validFloat(0.1, 10),
            }),
            dynamics: fc.record({
              velocity: validFloat(0, 1),
              normalize: fc.boolean(),
            }),
            metadata: fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              category: fc.constantFrom('kick', 'snare', 'hihat', 'tom', 'perc', 'bass', 'lead', 'pad', 'fx', 'other'),
              description: fc.string({ maxLength: 200 }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
            }),
          }),
          (config: SoundConfig) => {
            // Clear storage before each test
            clearAllPresets();

            // Serialize and deserialize to match what happens in storage
            // This removes undefined fields just like JSON.stringify/parse does
            const normalizedConfig = JSON.parse(JSON.stringify(config)) as SoundConfig;

            // Save the preset
            const saved = savePreset('Test Preset', normalizedConfig);

            // Load the preset
            const loaded = loadPreset(saved.id);

            // The loaded config should match the normalized config
            expect(loaded.config).toEqual(normalizedConfig);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: synth-ui, Property 15: Preset Deletion
     * For any saved preset, deleting it should remove it from storage and 
     * it should no longer appear in the preset list.
     * Validates: Requirements 8.4
     */
    test('Property 15: Preset Deletion', () => {
      // Helper to create valid float generator that avoids NaN
      const validFloat = (min: number, max: number) => 
        fc.float({ min: Math.fround(min), max: Math.fround(max), noNaN: true });

      fc.assert(
        fc.property(
          // Generate an array of preset names and configs
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              fc.record({
                synthesis: fc.record({
                  layers: fc.array(
                    fc.record({
                      type: fc.constantFrom('oscillator', 'noise', 'fm', 'karplus-strong'),
                      gain: validFloat(0, 1),
                      oscillator: fc.option(fc.record({
                        waveform: fc.constantFrom('sine', 'square', 'sawtooth', 'triangle'),
                        frequency: validFloat(20, 20000),
                        detune: validFloat(-100, 100),
                      }), { nil: undefined }),
                      noise: fc.option(fc.record({
                        type: fc.constantFrom('white', 'pink', 'brown'),
                      }), { nil: undefined }),
                      fm: fc.option(fc.record({
                        carrier: validFloat(20, 20000),
                        modulator: validFloat(20, 20000),
                        modulationIndex: validFloat(0, 1000),
                      }), { nil: undefined }),
                      karplus: fc.option(fc.record({
                        frequency: validFloat(20, 2000),
                        damping: validFloat(0, 1),
                      }), { nil: undefined }),
                    }),
                    { minLength: 1, maxLength: 8 }
                  ),
                }),
                envelope: fc.record({
                  attack: validFloat(0.001, 5),
                  decay: validFloat(0.001, 5),
                  sustain: validFloat(0, 1),
                  release: validFloat(0.001, 10),
                }),
                effects: fc.record({}),
                timing: fc.record({
                  duration: validFloat(0.1, 10),
                }),
                dynamics: fc.record({
                  velocity: validFloat(0, 1),
                  normalize: fc.boolean(),
                }),
                metadata: fc.record({
                  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                  category: fc.constantFrom('kick', 'snare', 'hihat', 'tom', 'perc', 'bass', 'lead', 'pad', 'fx', 'other'),
                  description: fc.string({ maxLength: 200 }),
                  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
                }),
              })
            ),
            { minLength: 1, maxLength: 10 }
          ),
          // Generate an index to delete
          fc.nat(),
          (presetData, deleteIndex) => {
            // Clear storage before each test
            clearAllPresets();

            // Save all presets
            const savedPresets = presetData.map(([name, config]) => {
              const normalizedConfig = JSON.parse(JSON.stringify(config)) as SoundConfig;
              return savePreset(name, normalizedConfig);
            });

            // Get initial count
            const initialCount = listPresets().length;
            expect(initialCount).toBe(savedPresets.length);

            // Pick a preset to delete (use modulo to ensure valid index)
            const indexToDelete = deleteIndex % savedPresets.length;
            const presetToDelete = savedPresets[indexToDelete];

            // Delete the preset
            deletePreset(presetToDelete.id);

            // Verify it's removed from the list
            const remainingPresets = listPresets();
            expect(remainingPresets.length).toBe(initialCount - 1);

            // Verify the deleted preset is not in the list
            const deletedPresetStillExists = remainingPresets.some(p => p.id === presetToDelete.id);
            expect(deletedPresetStillExists).toBe(false);

            // Verify all other presets are still there
            const otherPresetIds = savedPresets
              .filter((_, idx) => idx !== indexToDelete)
              .map(p => p.id);
            
            for (const id of otherPresetIds) {
              const stillExists = remainingPresets.some(p => p.id === id);
              expect(stillExists).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

import { describe, test, expect, beforeEach } from 'vitest';
import { DEFAULT_SOUND_CONFIG } from '../types/soundConfig';
import { clearAllPresets, savePreset, setDefaultPreset, getDefaultPreset } from '../utils/presets';

describe('useDefaultPreset logic', () => {
  beforeEach(() => {
    clearAllPresets();
  });

  test('should return null when no default preset is saved', () => {
    const defaultPreset = getDefaultPreset();
    expect(defaultPreset).toBeNull();
  });

  test('should load saved default preset from storage', () => {
    // Save a preset and set it as default
    const customConfig = { ...DEFAULT_SOUND_CONFIG };
    customConfig.metadata.name = 'Custom Default';
    customConfig.envelope.attack = 0.5;
    
    const preset = savePreset('Custom Default', customConfig);
    setDefaultPreset(preset.id);

    // Should load the custom default
    const defaultPreset = getDefaultPreset();
    expect(defaultPreset).not.toBeNull();
    expect(defaultPreset!.config.metadata.name).toBe('Custom Default');
    expect(defaultPreset!.config.envelope.attack).toBe(0.5);
  });

  test('should return null if no default is set', () => {
    // Save a preset but don't set it as default
    const customConfig = { ...DEFAULT_SOUND_CONFIG };
    customConfig.metadata.name = 'Not Default';
    
    savePreset('Not Default', customConfig);

    // Should return null since no default is set
    const defaultPreset = getDefaultPreset();
    expect(defaultPreset).toBeNull();
  });
});

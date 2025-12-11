import { describe, test, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PresetManager } from './PresetManager';
import { DEFAULT_SOUND_CONFIG } from '../types/soundConfig';
import { clearAllPresets, savePreset, listPresets } from '../utils/presets';

describe('PresetManager', () => {
  beforeEach(() => {
    clearAllPresets();
  });

  test('should render without errors', () => {
    const onLoadPreset = () => {};
    const html = renderToString(
      createElement(PresetManager, {
        currentConfig: DEFAULT_SOUND_CONFIG,
        onLoadPreset,
      })
    );

    expect(html).toBeTruthy();
    expect(html).toContain('Save Preset');
    expect(html).toContain('Load Preset');
  });

  test('should integrate with preset storage utilities', () => {
    // Save a preset using the utility
    const testConfig = { ...DEFAULT_SOUND_CONFIG };
    testConfig.metadata.name = 'Test Preset';
    
    const saved = savePreset('Test Preset', testConfig);
    expect(saved.name).toBe('Test Preset');
    expect(saved.config).toEqual(testConfig);

    // Verify it's in storage
    const presets = listPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Test Preset');
  });

  test('should handle empty preset list', () => {
    const presets = listPresets();
    expect(presets).toHaveLength(0);
  });
});

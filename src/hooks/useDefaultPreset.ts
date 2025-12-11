import { useEffect, useState } from 'react';
import { DEFAULT_SOUND_CONFIG, type SoundConfig } from '../types/soundConfig';
import { getDefaultPreset } from '../utils/presets';

/**
 * Hook to load default preset on initialization
 * Loads saved default preset from storage if available, otherwise uses DEFAULT_SOUND_CONFIG
 */
export function useDefaultPreset(): SoundConfig {
  const [config, setConfig] = useState<SoundConfig>(DEFAULT_SOUND_CONFIG);

  useEffect(() => {
    // Try to load saved default preset from storage
    try {
      const defaultPreset = getDefaultPreset();
      if (defaultPreset) {
        setConfig(defaultPreset.config);
      } else {
        // No saved default, use hardcoded default
        setConfig(DEFAULT_SOUND_CONFIG);
      }
    } catch {
      // If storage fails, fall back to hardcoded default
      setConfig(DEFAULT_SOUND_CONFIG);
    }
  }, []);

  return config;
}

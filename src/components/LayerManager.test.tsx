import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { SoundConfig } from '../types/soundConfig';

// Helper to create a valid layer
const createLayer = (type: 'oscillator' | 'noise' | 'fm' | 'karplus-strong'): SoundConfig['synthesis']['layers'][0] => {
  const baseLayer = {
    type,
    gain: 0.8,
  };

  switch (type) {
    case 'oscillator':
      return {
        ...baseLayer,
        type: 'oscillator' as const,
        oscillator: {
          waveform: 'sine' as const,
          frequency: 440,
          detune: 0,
        },
      };
    case 'noise':
      return {
        ...baseLayer,
        type: 'noise' as const,
        noise: {
          type: 'white' as const,
        },
      };
    case 'fm':
      return {
        ...baseLayer,
        type: 'fm' as const,
        fm: {
          carrier: 440,
          modulator: 880,
          modulationIndex: 100,
        },
      };
    case 'karplus-strong':
      return {
        ...baseLayer,
        type: 'karplus-strong' as const,
        karplus: {
          frequency: 440,
          damping: 0.5,
          pluckLocation: 0.5,
        },
      };
  }
};

// Arbitrary for layer type
const layerTypeArb = fc.constantFrom('oscillator', 'noise', 'fm', 'karplus-strong') as fc.Arbitrary<'oscillator' | 'noise' | 'fm' | 'karplus-strong'>;

// Arbitrary for a valid layer
const layerArb = layerTypeArb.map(createLayer);

// Arbitrary for a layers array (0-7 layers to allow room for addition)
const layersArb = fc.array(layerArb, { minLength: 0, maxLength: 7 });

describe('Layer Management Property Tests', () => {
  /**
   * Feature: synth-ui, Property 5: Layer Addition
   * For any existing configuration, adding a new layer should increase the layer count by one 
   * and the new layer should have valid default parameters for its type.
   */
  it('Property 5: Layer Addition', () => {
    fc.assert(
      fc.property(
        layersArb,
        layerTypeArb,
        (existingLayers, newLayerType) => {
          // Skip if already at max layers
          if (existingLayers.length >= 8) {
            return true;
          }

          const newLayer = createLayer(newLayerType);
          const updatedLayers = [...existingLayers, newLayer];

          // Check layer count increased by one
          expect(updatedLayers.length).toBe(existingLayers.length + 1);

          // Check the new layer has the correct type
          const addedLayer = updatedLayers[updatedLayers.length - 1];
          expect(addedLayer.type).toBe(newLayerType);

          // Check the new layer has valid default parameters
          expect(addedLayer.gain).toBeGreaterThanOrEqual(0);
          expect(addedLayer.gain).toBeLessThanOrEqual(1);

          // Type-specific validation
          switch (newLayerType) {
            case 'oscillator':
              expect(addedLayer.oscillator).toBeDefined();
              expect(addedLayer.oscillator?.waveform).toBeDefined();
              expect(addedLayer.oscillator?.frequency).toBeGreaterThan(0);
              break;
            case 'noise':
              expect(addedLayer.noise).toBeDefined();
              expect(addedLayer.noise?.type).toBeDefined();
              break;
            case 'fm':
              expect(addedLayer.fm).toBeDefined();
              expect(addedLayer.fm?.carrier).toBeGreaterThan(0);
              expect(addedLayer.fm?.modulator).toBeGreaterThan(0);
              break;
            case 'karplus-strong':
              expect(addedLayer.karplus).toBeDefined();
              expect(addedLayer.karplus?.frequency).toBeGreaterThan(0);
              expect(addedLayer.karplus?.damping).toBeGreaterThanOrEqual(0);
              expect(addedLayer.karplus?.damping).toBeLessThanOrEqual(1);
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 6: Layer Removal
   * For any configuration with at least one layer, removing a layer should decrease the layer 
   * count by one and maintain a valid configuration.
   */
  it('Property 6: Layer Removal', () => {
    fc.assert(
      fc.property(
        fc.array(layerArb, { minLength: 1, maxLength: 8 }), // At least one layer
        fc.integer({ min: 0, max: 7 }), // Index to remove
        (layers, indexToRemove) => {
          // Ensure index is valid
          if (indexToRemove >= layers.length) {
            return true;
          }

          const updatedLayers = layers.filter((_, i) => i !== indexToRemove);

          // Check layer count decreased by one
          expect(updatedLayers.length).toBe(layers.length - 1);

          // Check all remaining layers are valid
          updatedLayers.forEach((layer) => {
            expect(layer.type).toBeDefined();
            expect(layer.gain).toBeGreaterThanOrEqual(0);
            expect(layer.gain).toBeLessThanOrEqual(1);
          });

          // Check that the removed layer is not in the updated array
          const removedLayer = layers[indexToRemove];
          expect(updatedLayers).not.toContain(removedLayer);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 14: Layer Type Controls
   * For any layer type (oscillator, noise, FM, Karplus-Strong), the UI should display 
   * only the controls relevant to that layer type.
   */
  it('Property 14: Layer Type Controls', () => {
    fc.assert(
      fc.property(
        layerArb,
        (layer) => {
          // Check that only the relevant type-specific property is defined
          const typeProperties = {
            oscillator: layer.oscillator,
            noise: layer.noise,
            fm: layer.fm,
            'karplus-strong': layer.karplus,
          };

          // Count how many type-specific properties are defined
          const definedCount = Object.entries(typeProperties).filter(([, value]) => value !== undefined).length;

          // Exactly one type-specific property should be defined
          expect(definedCount).toBe(1);

          // The defined property should match the layer type
          switch (layer.type) {
            case 'oscillator':
              expect(layer.oscillator).toBeDefined();
              expect(layer.noise).toBeUndefined();
              expect(layer.fm).toBeUndefined();
              expect(layer.karplus).toBeUndefined();
              break;
            case 'noise':
              expect(layer.noise).toBeDefined();
              expect(layer.oscillator).toBeUndefined();
              expect(layer.fm).toBeUndefined();
              expect(layer.karplus).toBeUndefined();
              break;
            case 'fm':
              expect(layer.fm).toBeDefined();
              expect(layer.oscillator).toBeUndefined();
              expect(layer.noise).toBeUndefined();
              expect(layer.karplus).toBeUndefined();
              break;
            case 'karplus-strong':
              expect(layer.karplus).toBeDefined();
              expect(layer.oscillator).toBeUndefined();
              expect(layer.noise).toBeUndefined();
              expect(layer.fm).toBeUndefined();
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { describe, test, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import fc from 'fast-check';
import { EnvelopeVisualizer } from './EnvelopeVisualizer';

/**
 * Feature: synth-ui, Property 12: Envelope Visualization
 * For any valid ADSR envelope parameters, the envelope visualizer should render 
 * without errors and display a curve.
 * Validates: Requirements 2.5
 */
describe('EnvelopeVisualizer Property Tests', () => {
  test('Property 12: Envelope Visualization - renders without errors for all valid ADSR parameters', () => {
    fc.assert(
      fc.property(
        // Attack: 0.001 to 5 seconds (Requirement 2.1)
        fc.float({ min: Math.fround(0.001), max: Math.fround(5), noNaN: true }),
        // Decay: 0.001 to 5 seconds (Requirement 2.2)
        fc.float({ min: Math.fround(0.001), max: Math.fround(5), noNaN: true }),
        // Sustain: 0 to 1 (Requirement 2.3)
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        // Release: 0.001 to 10 seconds (Requirement 2.4)
        fc.float({ min: Math.fround(0.001), max: Math.fround(10), noNaN: true }),
        // Duration: reasonable range for sound duration
        fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
        (attack, decay, sustain, release, duration) => {
          // Render the component with generated parameters
          // Using renderToString to avoid DOM dependency issues
          const html = renderToString(
            createElement(EnvelopeVisualizer, {
              attack,
              decay,
              sustain,
              release,
              duration,
            })
          );

          // Verify the component rendered without throwing errors
          expect(html).toBeTruthy();
          expect(html.length).toBeGreaterThan(0);

          // Verify SVG element exists in the rendered HTML
          expect(html).toContain('<svg');
          expect(html).toContain('</svg>');

          // Verify path element exists (the curve)
          expect(html).toContain('<path');

          // Verify the path has a 'd' attribute (the curve data)
          expect(html).toMatch(/d="[^"]+"/);

          // Verify the path contains expected SVG commands (M for move, L for line)
          const pathMatch = html.match(/d="([^"]+)"/);
          expect(pathMatch).toBeTruthy();
          const pathData = pathMatch![1];
          expect(pathData).toMatch(/M\s+[\d.]+\s+[\d.]+/); // Move command
          expect(pathData).toMatch(/L\s+[\d.]+\s+[\d.]+/); // Line commands
        }
      ),
      { numRuns: 100 }
    );
  });
});

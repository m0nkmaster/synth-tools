# Requirements Document

## Introduction

This document specifies requirements for a professional synthesizer user interface for the OP Done application. The interface will provide tactile, hardware-inspired controls for all synthesis parameters, enabling users to design sounds through direct manipulation of synthesis layers, envelopes, filters, effects, and modulation. The UI will replace the current JSON-based test harness with an intuitive, visual interface suitable for music producers and sound designers. However, there will still be an option to view the underlying JSON config which can be updated directly - and updates when settings are changed through the UI.

## Glossary

- **Synthesizer UI**: The graphical user interface component that provides controls for sound synthesis parameters
- **Layer**: A single sound generation source (oscillator, noise, FM, or Karplus-Strong) within the synthesis engine
- **ADSR Envelope**: Attack-Decay-Sustain-Release amplitude envelope controlling sound dynamics over time
- **LFO**: Low Frequency Oscillator used for modulation of synthesis parameters
- **Filter Cutoff**: The frequency at which a filter begins attenuating the signal
- **Resonance (Q)**: The emphasis of frequencies near the filter cutoff point
- **Unison**: Multiple detuned voices playing simultaneously to create thickness
- **Sub-oscillator**: An oscillator tuned one or two octaves below the main oscillator for bass weight
- **Karplus-Strong**: Physical modeling synthesis algorithm simulating plucked strings
- **FM Synthesis**: Frequency Modulation synthesis where one oscillator modulates another's frequency
- **Saturation**: Non-linear distortion effect that adds harmonic content
- **Dry/Wet Mix**: The balance between unprocessed (dry) and processed (wet) signal

## Requirements

### Requirement 1

**User Story:** As a sound designer, I want to control synthesis layers with visual controls, so that I can build complex sounds by combining multiple sound sources.

#### Acceptance Criteria

1. WHEN the Synthesizer UI loads THEN the Synthesizer UI SHALL display controls for managing up to 8 synthesis layers
2. WHEN a user adds a new layer THEN the Synthesizer UI SHALL create a layer with default parameters and display its controls
3. WHEN a user selects a layer type (oscillator, noise, FM, Karplus-Strong) THEN the Synthesizer UI SHALL display type-specific controls for that layer
4. WHEN a user adjusts a layer gain control THEN the Synthesizer UI SHALL update the layer mix level between 0 and 1
5. WHEN a user removes a layer THEN the Synthesizer UI SHALL delete the layer from the configuration and update the display

### Requirement 2

**User Story:** As a music producer, I want to shape sounds with ADSR envelopes, so that I can control how sounds evolve over time.

#### Acceptance Criteria

1. WHEN the user adjusts the attack control THEN the Synthesizer UI SHALL update the envelope attack time between 0.001 and 5 seconds
2. WHEN the user adjusts the decay control THEN the Synthesizer UI SHALL update the envelope decay time between 0.001 and 5 seconds
3. WHEN the user adjusts the sustain control THEN the Synthesizer UI SHALL update the envelope sustain level between 0 and 1
4. WHEN the user adjusts the release control THEN the Synthesizer UI SHALL update the envelope release time between 0.001 and 10 seconds
5. WHEN envelope parameters change THEN the Synthesizer UI SHALL display a visual representation of the envelope curve

### Requirement 3

**User Story:** As a sound designer, I want to control oscillator parameters with knobs and switches, so that I can sculpt the harmonic content of my sounds.

#### Acceptance Criteria

1. WHEN a user selects an oscillator waveform (sine, square, sawtooth, triangle) THEN the Synthesizer UI SHALL update the oscillator waveform parameter
2. WHEN a user adjusts the frequency control THEN the Synthesizer UI SHALL update the oscillator frequency between 20 and 20000 Hz
3. WHEN a user adjusts the detune control THEN the Synthesizer UI SHALL update the oscillator detune between -100 and 100 cents
4. WHEN a user enables unison mode THEN the Synthesizer UI SHALL display controls for voices (1-8), detune spread, and stereo width
5. WHEN a user enables sub-oscillator THEN the Synthesizer UI SHALL display controls for sub level, octave (-1 or -2), and waveform

### Requirement 4

**User Story:** As a sound designer, I want to control filter parameters with visual feedback, so that I can shape the frequency content of sounds.

#### Acceptance Criteria

1. WHEN a user selects a filter type (lowpass, highpass, bandpass, notch, allpass, peaking) THEN the Synthesizer UI SHALL update the filter type parameter
2. WHEN a user adjusts the filter cutoff control THEN the Synthesizer UI SHALL update the filter frequency between 20 and 20000 Hz
3. WHEN a user adjusts the resonance control THEN the Synthesizer UI SHALL update the filter Q value between 0.0001 and 100
4. WHEN a user enables filter envelope THEN the Synthesizer UI SHALL display ADSR controls for filter modulation
5. WHEN a user adjusts filter envelope amount THEN the Synthesizer UI SHALL update the frequency modulation amount between -10000 and 10000 Hz

### Requirement 5

**User Story:** As a music producer, I want to add effects with intuitive controls, so that I can enhance sounds with reverb, delay, distortion, and dynamics processing.

#### Acceptance Criteria

1. WHEN a user enables reverb THEN the Synthesizer UI SHALL display controls for decay (0-10s), damping (0-1), and mix (0-1)
2. WHEN a user enables delay THEN the Synthesizer UI SHALL display controls for time (0-2s), feedback (0-0.9), and mix (0-1)
3. WHEN a user enables distortion THEN the Synthesizer UI SHALL display controls for type selection, amount (0-1), and mix (0-1)
4. WHEN a user enables compressor THEN the Synthesizer UI SHALL display controls for threshold, ratio, attack, release, and knee
5. WHEN a user enables gate THEN the Synthesizer UI SHALL display controls for attack, hold, and release times

### Requirement 6

**User Story:** As a sound designer, I want to add modulation with LFO controls, so that I can create movement and animation in my sounds.

#### Acceptance Criteria

1. WHEN a user enables LFO THEN the Synthesizer UI SHALL display controls for waveform, frequency, depth, and target parameter
2. WHEN a user selects an LFO waveform (sine, square, sawtooth, triangle, random) THEN the Synthesizer UI SHALL update the LFO waveform parameter
3. WHEN a user adjusts LFO frequency THEN the Synthesizer UI SHALL update the frequency between 0.01 and 20 Hz
4. WHEN a user selects an LFO target (pitch, filter, amplitude, pan) THEN the Synthesizer UI SHALL route the LFO to that parameter
5. WHEN a user adjusts LFO delay and fade THEN the Synthesizer UI SHALL update the LFO onset timing parameters

### Requirement 7

**User Story:** As a music producer, I want to preview sounds in real-time, so that I can hear the results of my parameter adjustments immediately.

#### Acceptance Criteria

1. WHEN a user clicks the play button THEN the Synthesizer UI SHALL synthesize the current configuration and play the audio
2. WHEN audio is playing THEN the Synthesizer UI SHALL disable the play button and display playing state
3. WHEN audio playback completes THEN the Synthesizer UI SHALL re-enable the play button
4. WHEN synthesis fails THEN the Synthesizer UI SHALL display an error message to the user
5. WHEN a user adjusts the duration control THEN the Synthesizer UI SHALL update the sound duration between 0.1 and 10 seconds

### Requirement 8

**User Story:** As a sound designer, I want to save and load presets, so that I can reuse and share sound configurations.

#### Acceptance Criteria

1. WHEN a user clicks save preset THEN the Synthesizer UI SHALL store the current configuration with a user-provided name
2. WHEN a user loads a preset THEN the Synthesizer UI SHALL restore all synthesis parameters from the saved configuration
3. WHEN a user views the preset list THEN the Synthesizer UI SHALL display all available presets with their names and categories
4. WHEN a user deletes a preset THEN the Synthesizer UI SHALL remove the preset from storage
5. WHEN the Synthesizer UI initializes THEN the Synthesizer UI SHALL load a default preset configuration

### Requirement 9

**User Story:** As a music producer, I want the UI to have a professional, hardware-inspired aesthetic, so that the interface feels tactile and familiar.

#### Acceptance Criteria

1. WHEN controls are rendered THEN the Synthesizer UI SHALL use circular knobs for continuous parameters
2. WHEN controls are rendered THEN the Synthesizer UI SHALL use toggle switches for boolean parameters
3. WHEN controls are rendered THEN the Synthesizer UI SHALL use segmented buttons for discrete parameter selection
4. WHEN a user hovers over a control THEN the Synthesizer UI SHALL provide visual feedback indicating interactivity
5. WHEN a user adjusts a control THEN the Synthesizer UI SHALL display the current parameter value

### Requirement 10

**User Story:** As a sound designer, I want to control noise generator parameters, so that I can create percussion and textural sounds.

#### Acceptance Criteria

1. WHEN a user selects noise type (white, pink, brown) THEN the Synthesizer UI SHALL update the noise generator type parameter
2. WHEN a user adds a noise layer THEN the Synthesizer UI SHALL display noise-specific controls
3. WHEN a user applies a filter to a noise layer THEN the Synthesizer UI SHALL display layer-specific filter controls
4. WHEN a user adjusts noise layer gain THEN the Synthesizer UI SHALL update the noise mix level
5. WHEN a user applies saturation to a noise layer THEN the Synthesizer UI SHALL display saturation controls for drive, type, and mix

### Requirement 11

**User Story:** As a sound designer, I want to use FM synthesis controls, so that I can create complex harmonic and inharmonic timbres.

#### Acceptance Criteria

1. WHEN a user adds an FM layer THEN the Synthesizer UI SHALL display controls for carrier frequency, modulator frequency, and modulation index
2. WHEN a user adjusts carrier frequency THEN the Synthesizer UI SHALL update the carrier oscillator frequency between 20 and 20000 Hz
3. WHEN a user adjusts modulator frequency THEN the Synthesizer UI SHALL update the modulator oscillator frequency between 20 and 20000 Hz
4. WHEN a user adjusts modulation index THEN the Synthesizer UI SHALL update the FM depth between 0 and 1000
5. WHEN a user adjusts FM layer gain THEN the Synthesizer UI SHALL update the FM layer mix level

### Requirement 12

**User Story:** As a sound designer, I want to use Karplus-Strong synthesis controls, so that I can create realistic plucked string sounds.

#### Acceptance Criteria

1. WHEN a user adds a Karplus-Strong layer THEN the Synthesizer UI SHALL display controls for frequency, damping, and pluck location
2. WHEN a user adjusts Karplus-Strong frequency THEN the Synthesizer UI SHALL update the string frequency between 20 and 2000 Hz
3. WHEN a user adjusts damping THEN the Synthesizer UI SHALL update the brightness decay between 0 and 1
4. WHEN a user adjusts pluck location THEN the Synthesizer UI SHALL update the excitation position between 0 and 1
5. WHEN a user adjusts Karplus-Strong layer gain THEN the Synthesizer UI SHALL update the layer mix level

### Requirement 13

**User Story:** As a music producer, I want to control sound metadata, so that I can organize and categorize my sounds.

#### Acceptance Criteria

1. WHEN a user enters a sound name THEN the Synthesizer UI SHALL update the metadata name field
2. WHEN a user selects a category (kick, snare, hihat, tom, perc, bass, lead, pad, fx, other) THEN the Synthesizer UI SHALL update the metadata category
3. WHEN a user enters a description THEN the Synthesizer UI SHALL update the metadata description field
4. WHEN a user adds tags THEN the Synthesizer UI SHALL append tags to the metadata tags array
5. WHEN a user removes a tag THEN the Synthesizer UI SHALL remove the tag from the metadata tags array

### Requirement 14

**User Story:** As a sound designer, I want to export synthesized sounds, so that I can use them in my music production workflow.

#### Acceptance Criteria

1. WHEN a user clicks export THEN the Synthesizer UI SHALL synthesize the current configuration and generate an audio file
2. WHEN export completes THEN the Synthesizer UI SHALL trigger a download of the audio file in WAV format
3. WHEN export is in progress THEN the Synthesizer UI SHALL display a loading indicator
4. WHEN export fails THEN the Synthesizer UI SHALL display an error message
5. WHEN a user exports a sound THEN the Synthesizer UI SHALL use the metadata name as the default filename

### Requirement 15

**User Story:** As a developer, I want to edit the synthesis configuration JSON directly, so that I can make precise adjustments and the UI reflects my changes in real-time.

#### Acceptance Criteria

1. WHEN the Synthesizer UI displays THEN the Synthesizer UI SHALL provide a JSON editor view alongside the visual controls
2. WHEN a user modifies the JSON configuration THEN the Synthesizer UI SHALL update all visual controls to reflect the JSON values
3. WHEN a user adjusts a visual control THEN the Synthesizer UI SHALL update the JSON configuration in real-time
4. WHEN the JSON contains invalid syntax THEN the Synthesizer UI SHALL display validation errors and prevent application of invalid changes
5. WHEN the JSON contains valid syntax but invalid parameter values THEN the Synthesizer UI SHALL display validation warnings and clamp values to valid ranges

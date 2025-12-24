/**
 * useStepSequencer - 16-step sequencer hook for melodic patterns
 * Uses setInterval for timing with tempo-derived step duration
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface Step {
  note: number | null; // MIDI note number, null = rest
}

interface UseStepSequencerOptions {
  onNoteOn?: (note: number, velocity: number) => void;
  onNoteOff?: (note: number) => void;
}

interface UseStepSequencerReturn {
  steps: Step[];
  tempo: number;
  isRunning: boolean;
  currentStep: number;
  setStep: (index: number, note: number | null) => void;
  setTempo: (bpm: number) => void;
  start: () => void;
  stop: () => void;
  hasSteps: () => boolean;
  clearAllSteps: () => void;
}

const STEP_COUNT = 16;
const DEFAULT_TEMPO = 120;
const MIN_TEMPO = 40;
const MAX_TEMPO = 240;
const DEFAULT_VELOCITY = 100;
const GATE_RATIO = 0.8; // Note plays for 80% of step duration, releases for 20%

const createEmptySteps = (): Step[] =>
  Array.from({ length: STEP_COUNT }, () => ({ note: null }));

export function useStepSequencer(options: UseStepSequencerOptions = {}): UseStepSequencerReturn {
  const { onNoteOn, onNoteOff } = options;

  const [steps, setSteps] = useState<Step[]>(createEmptySteps);
  const [tempo, setTempoState] = useState(DEFAULT_TEMPO);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNoteRef = useRef<number | null>(null);
  const stepsRef = useRef(steps);

  // Keep stepsRef in sync
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  // Stable callback refs
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);
  useEffect(() => { onNoteOnRef.current = onNoteOn; }, [onNoteOn]);
  useEffect(() => { onNoteOffRef.current = onNoteOff; }, [onNoteOff]);

  const setStep = useCallback((index: number, note: number | null) => {
    if (index < 0 || index >= STEP_COUNT) return;
    setSteps(prev => {
      const next = [...prev];
      next[index] = { note };
      return next;
    });
  }, []);

  const setTempo = useCallback((bpm: number) => {
    setTempoState(Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, bpm)));
  }, []);

  const hasSteps = useCallback(() => {
    return steps.some(step => step.note !== null);
  }, [steps]);

  const clearAllSteps = useCallback(() => {
    setSteps(createEmptySteps());
  }, []);

  const stopCurrentNote = useCallback(() => {
    // Clear any pending gate timeout
    if (gateTimeoutRef.current) {
      clearTimeout(gateTimeoutRef.current);
      gateTimeoutRef.current = null;
    }
    if (currentNoteRef.current !== null) {
      onNoteOffRef.current?.(currentNoteRef.current);
      currentNoteRef.current = null;
    }
  }, []);

  const playStep = useCallback((stepIndex: number, stepDuration: number) => {
    // Clear any pending gate timeout from previous step
    if (gateTimeoutRef.current) {
      clearTimeout(gateTimeoutRef.current);
      gateTimeoutRef.current = null;
    }
    
    // Release previous note immediately (it's had its gate time)
    if (currentNoteRef.current !== null) {
      onNoteOffRef.current?.(currentNoteRef.current);
      currentNoteRef.current = null;
    }
    
    const step = stepsRef.current[stepIndex];
    if (step.note !== null) {
      const noteToPlay = step.note;
      currentNoteRef.current = noteToPlay;
      onNoteOnRef.current?.(noteToPlay, DEFAULT_VELOCITY);
      
      // Schedule noteOff at gate time (before next step)
      const gateTime = stepDuration * GATE_RATIO;
      gateTimeoutRef.current = setTimeout(() => {
        if (currentNoteRef.current === noteToPlay) {
          onNoteOffRef.current?.(noteToPlay);
          currentNoteRef.current = null;
        }
      }, gateTime);
    }
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (gateTimeoutRef.current) {
      clearTimeout(gateTimeoutRef.current);
      gateTimeoutRef.current = null;
    }
    stopCurrentNote();
    setIsRunning(false);
    setCurrentStep(0);
  }, [stopCurrentNote]);

  const start = useCallback(() => {
    if (isRunning) return;
    
    setIsRunning(true);
    setCurrentStep(0);
    
    // Calculate step duration: 60000ms / BPM / 4 (16th notes)
    const stepDuration = 60000 / tempo / 4;
    
    // Play first step immediately
    playStep(0, stepDuration);

    let step = 0;
    intervalRef.current = setInterval(() => {
      step = (step + 1) % STEP_COUNT;
      setCurrentStep(step);
      playStep(step, stepDuration);
    }, stepDuration);
  }, [isRunning, tempo, playStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (gateTimeoutRef.current) {
        clearTimeout(gateTimeoutRef.current);
      }
    };
  }, []);

  // Update interval when tempo changes while running
  useEffect(() => {
    if (!isRunning || !intervalRef.current) return;
    
    // Restart with new tempo
    clearInterval(intervalRef.current);
    
    const stepDuration = 60000 / tempo / 4;
    let step = currentStep;
    
    intervalRef.current = setInterval(() => {
      step = (step + 1) % STEP_COUNT;
      setCurrentStep(step);
      playStep(step, stepDuration);
    }, stepDuration);
  }, [tempo, isRunning, currentStep, playStep]);

  return {
    steps,
    tempo,
    isRunning,
    currentStep,
    setStep,
    setTempo,
    start,
    stop,
    hasSteps,
    clearAllSteps,
  };
}

// Generate all MIDI notes for dropdown
export const MIDI_NOTES: { value: number; label: string }[] = [];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// C0 (MIDI 12) to C8 (MIDI 108)
for (let midi = 12; midi <= 108; midi++) {
  const octave = Math.floor(midi / 12) - 1;
  const noteName = NOTE_NAMES[midi % 12];
  MIDI_NOTES.push({ value: midi, label: `${noteName}${octave}` });
}


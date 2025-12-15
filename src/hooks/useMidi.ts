/**
 * useMidi - Web MIDI API hook for handling MIDI device connections and messages
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
}

export interface MidiNote {
  note: number;      // MIDI note number (0-127)
  velocity: number;  // Velocity (0-127, 0 = note off)
  channel: number;   // MIDI channel (0-15)
}

export interface MidiCC {
  controller: number; // CC number (0-127)
  value: number;      // CC value (0-127)
  channel: number;
}

interface UseMidiOptions {
  onNoteOn?: (note: MidiNote) => void;
  onNoteOff?: (note: MidiNote) => void;
  onCC?: (cc: MidiCC) => void;
  onPitchBend?: (value: number, channel: number) => void;
}

interface UseMidiReturn {
  supported: boolean;
  enabled: boolean;
  devices: MidiDevice[];
  selectedDeviceId: string | null;
  selectDevice: (deviceId: string | null) => void;
  error: string | null;
  activeNotes: Set<number>;
  lastNote: MidiNote | null;
}

/** Convert MIDI note number to frequency */
export const midiToFrequency = (note: number): number =>
  440 * Math.pow(2, (note - 69) / 12);

/** Convert MIDI velocity (0-127) to normalized value (0-1) */
export const midiVelocityToGain = (velocity: number): number =>
  velocity / 127;

/** Get note name from MIDI note number */
export const midiNoteToName = (note: number): string => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  return `${names[note % 12]}${octave}`;
};

export function useMidi(options: UseMidiOptions = {}): UseMidiReturn {
  const { onNoteOn, onNoteOff, onCC, onPitchBend } = options;
  
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [lastNote, setLastNote] = useState<MidiNote | null>(null);
  
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const selectedInputRef = useRef<MIDIInput | null>(null);
  
  // Stable callback refs
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);
  const onCCRef = useRef(onCC);
  const onPitchBendRef = useRef(onPitchBend);
  
  useEffect(() => { onNoteOnRef.current = onNoteOn; }, [onNoteOn]);
  useEffect(() => { onNoteOffRef.current = onNoteOff; }, [onNoteOff]);
  useEffect(() => { onCCRef.current = onCC; }, [onCC]);
  useEffect(() => { onPitchBendRef.current = onPitchBend; }, [onPitchBend]);

  // Handle MIDI messages
  const handleMidiMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 2) return;
    
    const status = data[0];
    const command = status & 0xf0;
    const channel = status & 0x0f;
    
    switch (command) {
      case 0x90: { // Note On
        const note = data[1];
        const velocity = data[2];
        const midiNote: MidiNote = { note, velocity, channel };
        
        if (velocity > 0) {
          setActiveNotes(prev => new Set(prev).add(note));
          setLastNote(midiNote);
          onNoteOnRef.current?.(midiNote);
        } else {
          // Note On with velocity 0 = Note Off
          setActiveNotes(prev => {
            const next = new Set(prev);
            next.delete(note);
            return next;
          });
          onNoteOffRef.current?.(midiNote);
        }
        break;
      }
      
      case 0x80: { // Note Off
        const note = data[1];
        const velocity = data[2];
        const midiNote: MidiNote = { note, velocity, channel };
        
        setActiveNotes(prev => {
          const next = new Set(prev);
          next.delete(note);
          return next;
        });
        onNoteOffRef.current?.(midiNote);
        break;
      }
      
      case 0xb0: { // Control Change
        const controller = data[1];
        const value = data[2];
        onCCRef.current?.({ controller, value, channel });
        break;
      }
      
      case 0xe0: { // Pitch Bend
        const lsb = data[1];
        const msb = data[2];
        // Convert to -1 to 1 range (8192 = center)
        const value = ((msb << 7) | lsb) / 8192 - 1;
        onPitchBendRef.current?.(value, channel);
        break;
      }
    }
  }, []);

  // Update device list
  const updateDevices = useCallback((access: MIDIAccess) => {
    const inputDevices: MidiDevice[] = [];
    access.inputs.forEach((input) => {
      inputDevices.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state as 'connected' | 'disconnected',
      });
    });
    setDevices(inputDevices);
  }, []);

  // Initialize MIDI
  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setSupported(false);
      return;
    }
    
    setSupported(true);
    
    navigator.requestMIDIAccess({ sysex: false })
      .then((access) => {
        midiAccessRef.current = access;
        setEnabled(true);
        updateDevices(access);
        
        // Listen for device changes
        access.onstatechange = () => updateDevices(access);
        
        // Auto-select first device if available
        const firstInput = access.inputs.values().next().value;
        if (firstInput) {
          setSelectedDeviceId(firstInput.id);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to access MIDI devices');
        setEnabled(false);
      });
    
    return () => {
      if (midiAccessRef.current) {
        midiAccessRef.current.onstatechange = null;
      }
    };
  }, [updateDevices]);

  // Handle device selection
  const selectDevice = useCallback((deviceId: string | null) => {
    // Disconnect from previous device
    if (selectedInputRef.current) {
      selectedInputRef.current.onmidimessage = null;
      selectedInputRef.current = null;
    }
    
    setSelectedDeviceId(deviceId);
    setActiveNotes(new Set());
    
    if (!deviceId || !midiAccessRef.current) return;
    
    const input = midiAccessRef.current.inputs.get(deviceId);
    if (input) {
      input.onmidimessage = handleMidiMessage;
      selectedInputRef.current = input;
    }
  }, [handleMidiMessage]);

  // Connect to selected device when it changes
  useEffect(() => {
    if (selectedDeviceId && midiAccessRef.current) {
      const input = midiAccessRef.current.inputs.get(selectedDeviceId);
      if (input) {
        input.onmidimessage = handleMidiMessage;
        selectedInputRef.current = input;
      }
    }
    
    return () => {
      if (selectedInputRef.current) {
        selectedInputRef.current.onmidimessage = null;
      }
    };
  }, [selectedDeviceId, handleMidiMessage]);

  return {
    supported,
    enabled,
    devices,
    selectedDeviceId,
    selectDevice,
    error,
    activeNotes,
    lastNote,
  };
}





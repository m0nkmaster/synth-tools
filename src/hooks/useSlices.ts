import { useCallback, useMemo, useState } from 'react';
import { probeDuration } from '../audio/metadata';
import { classifyAudio } from '../audio/classify';
import { convertToWav } from '../audio/convert';
import { formatNamePrefix } from '../utils/naming';
import { MAX_SLICES, MAX_DURATION_SECONDS, DEFAULT_SILENCE_THRESHOLD } from '../constants';
import type { Slice, NormalizeMode } from '../types';

export function useSlices() {
  const [slices, setSlices] = useState<Slice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [normalizeMode, setNormalizeMode] = useState<NormalizeMode>('loudnorm');
  const [silenceThreshold, setSilenceThreshold] = useState(DEFAULT_SILENCE_THRESHOLD);
  const [maxDuration] = useState(MAX_DURATION_SECONDS);

  const totalDuration = useMemo(
    () => slices.reduce((acc, slice) => acc + (Number.isFinite(slice.duration) ? slice.duration : 0), 0),
    [slices]
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const incoming = Array.from(files);
      if (!incoming.length) return;

      if (slices.length + incoming.length > MAX_SLICES) {
        setError(`Too many slices. Max ${MAX_SLICES} allowed.`);
        return;
      }

      setIsProcessing(true);
      const mapped: Slice[] = [];
      for (const file of incoming) {
        try {
          const isAiff = /\.aiff?$/i.test(file.name);
          const playableBlob = isAiff ? await convertToWav(file) : file;
          
          const [duration, analysis, pitch] = await Promise.all([
            probeDuration(playableBlob),
            classifyAudio(playableBlob),
            (async () => {
              const { detectPitch } = await import('../audio/pitch');
              return detectPitch(file);
            })()
          ]);
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const ext = file.name.match(/\.[^.]+$/)?.[0] || '';
          const prefix = formatNamePrefix(analysis);
          mapped.push({
            id: crypto.randomUUID(),
            file,
            playableBlob: isAiff ? playableBlob : undefined,
            name: `${prefix}_${baseName}${ext}`,
            duration,
            status: 'ready',
            analysis,
            detectedNote: pitch.note,
            detectedFrequency: pitch.frequency,
            semitones: 0
          });
        } catch (err) {
          console.error(err);
          mapped.push({
            id: crypto.randomUUID(),
            file,
            name: file.name,
            duration: 0,
            status: 'error',
            error: 'Unable to read file'
          });
        }
      }
      setSlices((prev) => [...prev, ...mapped]);
      setIsProcessing(false);
    },
    [slices.length]
  );

  const removeSlice = useCallback((id: string) => {
    setSlices((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateSlice = useCallback((id: string, updates: Partial<Slice>) => {
    setSlices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const reorder = useCallback((fromIdx: number, toIdx: number) => {
    setSlices((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSlices([]);
    setError(null);
  }, []);

  return {
    slices,
    addFiles,
    removeSlice,
    updateSlice,
    reorder,
    reset,
    isProcessing,
    error,
    normalizeMode,
    silenceThreshold,
    maxDuration,
    totalDuration,
    setNormalizeMode,
    setSilenceThreshold
  };
}

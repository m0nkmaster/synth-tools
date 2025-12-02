import { useCallback, useMemo, useState } from 'react';
import { probeDuration } from '../audio/metadata';
import { classifyAudio } from '../audio/classify';
import type { Slice, NormalizeMode } from '../types';

const MAX_SLICES = 24;

export function useSlices() {
  const [slices, setSlices] = useState<Slice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [normalizeMode, setNormalizeMode] = useState<NormalizeMode>('loudnorm');
  const [silenceThreshold, setSilenceThreshold] = useState(-35);
  const [maxDuration] = useState(12);

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
          const [duration, classification] = await Promise.all([
            probeDuration(file),
            classifyAudio(file)
          ]);
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const ext = file.name.match(/\.[^.]+$/)?.[0] || '';
          mapped.push({
            id: crypto.randomUUID(),
            file,
            name: `${classification}_${baseName}${ext}`,
            duration,
            status: 'ready',
            classification
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

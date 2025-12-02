import { ensureFFmpeg } from './ffmpeg';

export async function convertToWav(file: File): Promise<Blob> {
  const ffmpeg = await ensureFFmpeg();
  const inputName = 'input.aif';
  const outputName = 'output.wav';
  
  await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
  await ffmpeg.exec(['-i', inputName, '-ar', '44100', '-ac', '1', outputName]);
  const data = await ffmpeg.readFile(outputName);
  
  return new Blob([data], { type: 'audio/wav' });
}

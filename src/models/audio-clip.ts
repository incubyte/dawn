export interface AudioClip {
  id: string;
  buffer: AudioBuffer | null;
  startTime: number; // In seconds
  duration: number; // In seconds
  offset: number; // In seconds
  name: string;
}

import { AudioClip } from './audio-clip';
import { Effect } from './effect';

export interface AudioTrack {
  id: string;
  gainValue: number;
  clips: AudioClip[];
  effects: Effect[];
  muted: boolean;
  solo: boolean;
}

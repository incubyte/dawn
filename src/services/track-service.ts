import { AudioTrack } from '../models/audio-track';
import { AudioClip } from '../models/audio-clip';
import { Effect } from '../models/effect';

export interface TrackService {
  addTrack(): AudioTrack;
  removeTrack(trackId: string): void;
  addClipToTrack(trackId: string, clip: AudioClip): void;
  removeClipFromTrack(trackId: string, clipId: string): void;
  updateClipPosition(trackId: string, clipId: string, startTime: number): void;
  addEffectToTrack(trackId: string, effect: Effect): void;
  removeEffectFromTrack(trackId: string, effectId: string): void;
  getTrackClips(trackId: string): AudioClip[];
  getAllTracks(): AudioTrack[];
  getTrackGainNode(trackId: string): GainNode | undefined;
}

export function createTrackService(
  audioContext: AudioContext,
  masterGainNode: GainNode
): TrackService {
  const tracks: Map<string, AudioTrack> = new Map();
  // Map to store audio nodes for each track
  const trackNodes: Map<string, { gainNode: GainNode, source?: AudioBufferSourceNode }> = new Map();
  
  return {
    addTrack(): AudioTrack {
      const id = crypto.randomUUID();
      
      // Create track gain node
      const gainNode = audioContext.createGain();
      gainNode.connect(masterGainNode);
      
      const track: AudioTrack = {
        id,
        gainValue: 1,
        clips: [],
        effects: [],
        muted: false,
        solo: false
      };
      
      tracks.set(id, track);
      trackNodes.set(id, { gainNode });
      
      return track;
    },
    
    removeTrack(trackId: string): void {
      const trackNode = trackNodes.get(trackId);
      if (trackNode) {
        // Disconnect from audio graph
        trackNode.gainNode.disconnect();
        trackNodes.delete(trackId);
      }
      
      tracks.delete(trackId);
    },
    
    addClipToTrack(trackId: string, clip: AudioClip): void {
      const track = tracks.get(trackId);
      if (track) {
        track.clips.push(clip);
      }
    },
    
    removeClipFromTrack(trackId: string, clipId: string): void {
      const track = tracks.get(trackId);
      if (track) {
        track.clips = track.clips.filter(clip => clip.id !== clipId);
      }
    },
    
    updateClipPosition(trackId: string, clipId: string, startTime: number): void {
      const track = tracks.get(trackId);
      if (track) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          clip.startTime = startTime;
        }
      }
    },
    
    addEffectToTrack(trackId: string, effect: Effect): void {
      const track = tracks.get(trackId);
      if (track) {
        track.effects.push(effect);
      }
    },
    
    removeEffectFromTrack(trackId: string, effectId: string): void {
      const track = tracks.get(trackId);
      if (track) {
        track.effects = track.effects.filter(effect => effect.id !== effectId);
      }
    },
    
    getTrackClips(trackId: string): AudioClip[] {
      const track = tracks.get(trackId);
      return track ? [...track.clips] : [];
    },
    
    getAllTracks(): AudioTrack[] {
      return Array.from(tracks.values());
    },
    
    getTrackGainNode(trackId: string): GainNode | undefined {
      const trackNode = trackNodes.get(trackId);
      return trackNode?.gainNode;
    }
  };
}
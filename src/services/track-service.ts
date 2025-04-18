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
  setTrackVolume(trackId: string, volume: number): void;
  toggleMute(trackId: string): boolean;
  toggleSolo(trackId: string): boolean;
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
    },
    
    setTrackVolume(trackId: string, volume: number): void {
      // Get the track data
      const track = tracks.get(trackId);
      const trackNode = trackNodes.get(trackId);
      
      if (!track || !trackNode) {
        console.warn(`Cannot set volume: Track ${trackId} not found`);
        return;
      }
      
      // Clamp volume value between 0 and 1
      const safeVolume = Math.max(0, Math.min(1, volume));
      
      // Update track data model
      track.gainValue = safeVolume;
      
      // Don't set gain value if track is muted
      if (track.muted) {
        return;
      }
      
      // Check for any solo tracks - if any exist, only those should be audible
      const hasSoloTracks = Array.from(tracks.values()).some(t => t.solo);
      
      if (hasSoloTracks && !track.solo) {
        // If there are solo tracks but this one isn't solo, set to 0
        trackNode.gainNode.gain.value = 0;
      } else {
        // Otherwise set to the desired volume
        // Using exponential ramp for smoother volume changes
        const currentTime = audioContext.currentTime;
        trackNode.gainNode.gain.cancelScheduledValues(currentTime);
        trackNode.gainNode.gain.setValueAtTime(trackNode.gainNode.gain.value, currentTime);
        trackNode.gainNode.gain.exponentialRampToValueAtTime(safeVolume === 0 ? 0.0001 : safeVolume, currentTime + 0.05);
        
        console.log(`Set track ${trackId} volume to ${safeVolume}`);
      }
    },
    
    toggleMute(trackId: string): boolean {
      const track = tracks.get(trackId);
      const trackNode = trackNodes.get(trackId);
      
      if (!track || !trackNode) {
        console.warn(`Cannot toggle mute: Track ${trackId} not found`);
        return false;
      }
      
      // Toggle mute state
      track.muted = !track.muted;
      
      // Update the gain node immediately
      const currentTime = audioContext.currentTime;
      if (track.muted) {
        // If muting, fade out quickly
        trackNode.gainNode.gain.cancelScheduledValues(currentTime);
        trackNode.gainNode.gain.setValueAtTime(trackNode.gainNode.gain.value, currentTime);
        trackNode.gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.02);
        console.log(`Muted track ${trackId}`);
      } else {
        // If unmuting, restore volume
        // Check for any solo tracks first
        const hasSoloTracks = Array.from(tracks.values()).some(t => t.solo);
        if (hasSoloTracks && !track.solo) {
          // Keep it muted if there are solo tracks but this isn't one
          console.log(`Track ${trackId} unmuted but inaudible due to solo on other tracks`);
        } else {
          // Restore volume if no solo conflicts
          trackNode.gainNode.gain.cancelScheduledValues(currentTime);
          trackNode.gainNode.gain.setValueAtTime(trackNode.gainNode.gain.value, currentTime);
          trackNode.gainNode.gain.exponentialRampToValueAtTime(track.gainValue === 0 ? 0.0001 : track.gainValue, currentTime + 0.02);
          console.log(`Unmuted track ${trackId} to volume ${track.gainValue}`);
        }
      }
      
      return track.muted;
    },
    
    toggleSolo(trackId: string): boolean {
      const track = tracks.get(trackId);
      
      if (!track) {
        console.warn(`Cannot toggle solo: Track ${trackId} not found`);
        return false;
      }
      
      // Toggle solo state
      track.solo = !track.solo;
      
      // Check if any tracks are now soloed
      const hasSoloTracks = Array.from(tracks.values()).some(t => t.solo);
      
      // Update all track gain nodes
      tracks.forEach((trackData, id) => {
        const trackNode = trackNodes.get(id);
        if (!trackNode) return;
        
        const currentTime = audioContext.currentTime;
        
        if (hasSoloTracks) {
          // Solo mode is active
          if (trackData.solo) {
            // This track is soloed and should be audible (unless also muted)
            if (!trackData.muted) {
              trackNode.gainNode.gain.cancelScheduledValues(currentTime);
              trackNode.gainNode.gain.setValueAtTime(trackNode.gainNode.gain.value, currentTime);
              trackNode.gainNode.gain.exponentialRampToValueAtTime(
                trackData.gainValue === 0 ? 0.0001 : trackData.gainValue, 
                currentTime + 0.02
              );
            }
          } else {
            // This track is not soloed and should be silent
            trackNode.gainNode.gain.cancelScheduledValues(currentTime);
            trackNode.gainNode.gain.setValueAtTime(trackNode.gainNode.gain.value, currentTime);
            trackNode.gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.02);
          }
        } else {
          // No tracks are soloed, restore normal volumes
          // (except for muted tracks)
          if (!trackData.muted) {
            trackNode.gainNode.gain.cancelScheduledValues(currentTime);
            trackNode.gainNode.gain.setValueAtTime(trackNode.gainNode.gain.value, currentTime);
            trackNode.gainNode.gain.exponentialRampToValueAtTime(
              trackData.gainValue === 0 ? 0.0001 : trackData.gainValue,
              currentTime + 0.02
            );
          }
        }
      });
      
      console.log(`${track.solo ? 'Soloed' : 'Unsoloed'} track ${trackId}`);
      return track.solo;
    }
  };
}
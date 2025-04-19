import { AudioTrack } from '../models/audio-track';
import { AudioClip } from '../models/audio-clip';
import { Effect } from '../models/effect';

export interface TrackService {
  addTrack(trackId?: string): AudioTrack;
  removeTrack(trackId: string): void;
  addClipToTrack(trackId: string, clip: AudioClip): void;
  removeClipFromTrack(trackId: string, clipId: string): void;
  updateClipPosition(trackId: string, clipId: string, startTime: number): void;
  moveClipToTrack(sourceTrackId: string, targetTrackId: string, clipId: string, newStartTime?: number): AudioClip | null;
  addEffectToTrack(trackId: string, effect: Effect): void;
  removeEffectFromTrack(trackId: string, effectId: string): void;
  updateEffectParameter(trackId: string, effectId: string, paramName: string, value: number): void;
  toggleEffectBypass(trackId: string, effectId: string): boolean;
  rebuildEffectChain(trackId: string): void;
  applyEffectParameters(effect: Effect): void;
  getTrackEffects(trackId: string): Effect[];
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
  const trackNodes: Map<string, { 
    gainNode: GainNode, 
    source?: AudioBufferSourceNode,
    effectChain?: AudioNode[] 
  }> = new Map();
  
  return {
    addTrack(trackId?: string): AudioTrack {
      const id = trackId || crypto.randomUUID();
      
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
      
      // Dispatch event for track added (for unsaved changes tracking)
      document.dispatchEvent(new CustomEvent('track:changed', {
        detail: { type: 'add', trackId: id }
      }));
      
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
      
      // Dispatch event for track removed (for unsaved changes tracking)
      document.dispatchEvent(new CustomEvent('track:changed', {
        detail: { type: 'remove', trackId }
      }));
    },
    
    addClipToTrack(trackId: string, clip: AudioClip): void {
      const track = tracks.get(trackId);
      if (track) {
        track.clips.push(clip);
        
        // Dispatch event for clip added (for unsaved changes tracking)
        document.dispatchEvent(new CustomEvent('clip:changed', {
          detail: { type: 'add', trackId, clipId: clip.id }
        }));
      }
    },
    
    removeClipFromTrack(trackId: string, clipId: string): void {
      const track = tracks.get(trackId);
      if (track) {
        track.clips = track.clips.filter(clip => clip.id !== clipId);
        
        // Dispatch event for clip removed (for unsaved changes tracking)
        document.dispatchEvent(new CustomEvent('clip:changed', {
          detail: { type: 'remove', trackId, clipId }
        }));
      }
    },
    
    updateClipPosition(trackId: string, clipId: string, startTime: number): void {
      const track = tracks.get(trackId);
      if (track) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          clip.startTime = startTime;
          
          // Dispatch event for clip position updated (for unsaved changes tracking)
          document.dispatchEvent(new CustomEvent('clip:changed', {
            detail: { type: 'position', trackId, clipId, startTime }
          }));
        }
      }
    },
    
    moveClipToTrack(sourceTrackId: string, targetTrackId: string, clipId: string, newStartTime?: number): AudioClip | null {
      // Get the source and target tracks
      const sourceTrack = tracks.get(sourceTrackId);
      const targetTrack = tracks.get(targetTrackId);
      
      if (!sourceTrack || !targetTrack) {
        console.warn(`Cannot move clip: Source or target track not found`);
        return null;
      }
      
      // Find the clip in the source track
      const clipIndex = sourceTrack.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) {
        console.warn(`Cannot move clip: Clip ${clipId} not found in source track ${sourceTrackId}`);
        return null;
      }
      
      // Remove the clip from the source track
      const [clip] = sourceTrack.clips.splice(clipIndex, 1);
      
      // If a new start time is provided, update it
      if (newStartTime !== undefined) {
        clip.startTime = newStartTime;
      }
      
      // Add the clip to the target track
      targetTrack.clips.push(clip);
      
      console.log(`Moved clip ${clipId} from track ${sourceTrackId} to track ${targetTrackId}`);
      
      return clip;
    },
    
    addEffectToTrack(trackId: string, effect: Effect): void {
      const track = tracks.get(trackId);
      const trackNode = trackNodes.get(trackId);
      
      if (!track || !trackNode) {
        console.warn(`Cannot add effect: Track ${trackId} not found`);
        return;
      }
      
      // Add to effects array in the track data
      track.effects.push(effect);
      
      // Apply initial parameters to ensure effect is properly configured
      this.applyEffectParameters(effect);
      
      // Rebuild the effect chain
      this.rebuildEffectChain(trackId);
      
      console.log(`Added ${effect.type} effect to track ${trackId}`);
      
      // Dispatch event for track changed
      document.dispatchEvent(new CustomEvent('track:changed', {
        detail: { type: 'effect-added', trackId, effectId: effect.id }
      }));
    },
    
    removeEffectFromTrack(trackId: string, effectId: string): void {
      const track = tracks.get(trackId);
      
      if (!track) {
        console.warn(`Cannot remove effect: Track ${trackId} not found`);
        return;
      }
      
      // Remove from the track's effects array
      const oldEffectsLength = track.effects.length;
      track.effects = track.effects.filter(effect => effect.id !== effectId);
      
      // Check if anything was actually removed
      if (track.effects.length === oldEffectsLength) {
        console.warn(`Effect ${effectId} not found in track ${trackId}`);
        return;
      }
      
      // Rebuild the effect chain
      this.rebuildEffectChain(trackId);
      
      console.log(`Removed effect ${effectId} from track ${trackId}`);
      
      // Dispatch event for track changed
      document.dispatchEvent(new CustomEvent('track:changed', {
        detail: { type: 'effect-removed', trackId, effectId }
      }));
    },
    
    // Helper method to rebuild the audio effects chain for a track
    rebuildEffectChain(trackId: string): void {
      const track = tracks.get(trackId);
      const trackNode = trackNodes.get(trackId);
      
      if (!track || !trackNode) {
        console.warn(`Cannot rebuild effect chain: Track ${trackId} not found`);
        return;
      }
      
      // Log the rebuilding process
      console.log(`Rebuilding effect chain for track ${trackId} with ${track.effects.length} total effects`);
      
      // Disconnect existing effect chain if any
      if (trackNode.effectChain && trackNode.effectChain.length > 0) {
        console.log(`Disconnecting existing effect chain with ${trackNode.effectChain.length} effects`);
        
        // Disconnect gain node from everything
        trackNode.gainNode.disconnect();
        
        // Disconnect all effects in the chain
        trackNode.effectChain.forEach(node => {
          try {
            // Use the custom disconnect method if available
            if (typeof (node as any).disconnect === 'function') {
              (node as any).disconnect();
              console.log(`Disconnected effect node using custom method`);
            } else {
              // Default disconnect
              node.disconnect();
              console.log(`Disconnected effect node using default method`);
            }
          } catch (err) {
            console.warn(`Error disconnecting node:`, err);
          }
        });
        
        // Clear the effect chain
        trackNode.effectChain = [];
      } else {
        // No effect chain yet, just disconnect gain node from master
        console.log(`No existing effect chain, disconnecting gain node from master`);
        trackNode.gainNode.disconnect();
      }
      
      if (track.effects.length === 0 || track.effects.every(effect => effect.bypass)) {
        // No effects or all effects are bypassed, connect gain directly to master
        console.log(`No active effects for track ${trackId}, connecting gain directly to master`);
        trackNode.gainNode.connect(masterGainNode);
        return;
      }
      
      // Create a new effect chain with only active (non-bypassed) effects
      const effectNodes: AudioNode[] = [];
      const activeEffects = track.effects.filter(effect => !effect.bypass && effect.node);
      
      // Process each active effect
      activeEffects.forEach((effect) => {
        console.log(`Adding ${effect.type} effect (id: ${effect.id}) to chain for track ${trackId}`);
        
        // Apply parameters to make sure they're current
        this.applyEffectParameters(effect);
        
        // Add to effect nodes list
        effectNodes.push(effect.node!);
      });
      
      // Store the effect chain
      trackNode.effectChain = effectNodes;
      
      if (effectNodes.length === 0) {
        // No active effects after filtering, connect gain directly to master
        console.log(`No active effects for track ${trackId} after filtering, connecting gain directly to master`);
        trackNode.gainNode.connect(masterGainNode);
        return;
      }
      
      // ========== CONNECT THE CHAIN ==========
      
      // First connect gain node to first effect
      console.log(`Connecting track gain node to first effect in chain: ${activeEffects[0].type}`);
      trackNode.gainNode.connect(effectNodes[0]);
      
      // Connect effects in sequence
      for (let i = 0; i < effectNodes.length - 1; i++) {
        const currentEffect = activeEffects[i];
        const nextEffect = activeEffects[i + 1];
        
        console.log(`Connecting effect ${i}: ${currentEffect.type} to effect ${i + 1}: ${nextEffect.type}`);
        
        try {
          // First try using the custom connect method if available
          // This allows effects to use their own connection logic for proper routing
          if (typeof (effectNodes[i] as any).connect === 'function' && 
              (effectNodes[i] as any).connect !== AudioNode.prototype.connect) {
            console.log(`Using custom connect method for effect ${currentEffect.type}`);
            (effectNodes[i] as any).connect(effectNodes[i + 1]);
          } 
          // If there's an effectObj with a connect method, use that
          else if ((effectNodes[i] as any).effectObj && 
                   typeof (effectNodes[i] as any).effectObj.connect === 'function') {
            console.log(`Using effectObj connect method for effect ${currentEffect.type}`);
            (effectNodes[i] as any).effectObj.connect(effectNodes[i + 1]);
          }
          // Default to the standard Web Audio API connect
          else {
            console.log(`Using standard connect method for effect ${currentEffect.type}`);
            effectNodes[i].disconnect(); // Ensure clean connections
            effectNodes[i].connect(effectNodes[i + 1]);
          }
        } catch (err) {
          console.error(`Error connecting effect ${i} to effect ${i + 1}:`, err);
          // Fallback to direct connection in case of error
          try {
            effectNodes[i].disconnect();
            effectNodes[i].connect(effectNodes[i + 1]);
            console.log(`Connected using fallback direct connection`);
          } catch (fallbackErr) {
            console.error(`Even fallback connection failed:`, fallbackErr);
          }
        }
      }
      
      // Connect last effect to master gain node
      const lastEffect = effectNodes[effectNodes.length - 1];
      const lastEffectData = activeEffects[activeEffects.length - 1];
      console.log(`Connecting last effect (${lastEffectData.type}) to master gain node`);
      
      try {
        // Try using custom connect method first
        if (typeof (lastEffect as any).connect === 'function' && 
            (lastEffect as any).connect !== AudioNode.prototype.connect) {
          console.log(`Using custom connect method for last effect`);
          (lastEffect as any).connect(masterGainNode);
        }
        // If there's an effectObj with a connect method, use that
        else if ((lastEffect as any).effectObj && 
                 typeof (lastEffect as any).effectObj.connect === 'function') {
          console.log(`Using effectObj connect method for last effect`);
          (lastEffect as any).effectObj.connect(masterGainNode);
        }
        // Default to standard Web Audio API connect
        else {
          console.log(`Using standard connect method for last effect`);
          lastEffect.disconnect(); // Ensure clean connections
          lastEffect.connect(masterGainNode);
        }
      } catch (err) {
        console.error(`Error connecting last effect to master:`, err);
        // Fallback to direct connection
        try {
          lastEffect.disconnect();
          lastEffect.connect(masterGainNode);
          console.log(`Connected last effect using fallback direct connection`);
        } catch (fallbackErr) {
          console.error(`Even fallback connection for last effect failed:`, fallbackErr);
        }
      }
      
      console.log(`Successfully rebuilt effect chain for track ${trackId} with ${effectNodes.length} active effects`);
    },
    
    updateEffectParameter(trackId: string, effectId: string, paramName: string, value: number): void {
      console.log(`Updating effect parameter: track=${trackId}, effect=${effectId}, param=${paramName}, value=${value}`);
      
      const track = tracks.get(trackId);
      
      if (!track) {
        console.warn(`Cannot update effect: Track ${trackId} not found`);
        return;
      }
      
      // Find the effect
      const effect = track.effects.find(e => e.id === effectId);
      if (!effect) {
        console.warn(`Effect ${effectId} not found in track ${trackId}`);
        return;
      }
      
      // Find the parameter
      const parameter = effect.parameters.find(p => p.name === paramName);
      if (!parameter) {
        console.warn(`Parameter ${paramName} not found in effect ${effectId}`);
        return;
      }
      
      // Clamp the value between min and max
      const clampedValue = Math.max(parameter.min, Math.min(parameter.max, value));
      
      // Update the parameter value in the data model
      parameter.value = clampedValue;
      
      if (!effect.node) {
        console.warn(`Effect ${effectId} has no audio node to apply parameter changes to`);
        return;
      }
      
      // Apply parameter to the effect node - this is the critical part
      try {
        // Direct parameter application based on effect type and parameter name
        if (effect.type === 'delay') {
          if (paramName === 'Time' && typeof (effect.node as any).setDelayTime === 'function') {
            console.log(`Directly setting delay time to ${clampedValue}`);
            (effect.node as any).setDelayTime(clampedValue);
          } 
          else if (paramName === 'Feedback' && typeof (effect.node as any).setFeedback === 'function') {
            console.log(`Directly setting delay feedback to ${clampedValue}`);
            (effect.node as any).setFeedback(clampedValue);
          }
          else if (paramName === 'Mix' && typeof (effect.node as any).setMix === 'function') {
            console.log(`Directly setting delay mix to ${clampedValue}`);
            (effect.node as any).setMix(clampedValue);
          }
        } 
        else if (effect.type === 'reverb') {
          if (paramName === 'Time' && typeof (effect.node as any).setReverbTime === 'function') {
            console.log(`Directly setting reverb time to ${clampedValue}`);
            (effect.node as any).setReverbTime(clampedValue);
          }
          else if (paramName === 'Mix' && typeof (effect.node as any).setMix === 'function') {
            console.log(`Directly setting reverb mix to ${clampedValue}`);
            (effect.node as any).setMix(clampedValue);
          }
        }
        
        // Also call the general applyEffectParameters as a backup approach
        this.applyEffectParameters(effect);
        
        // If the parameter change might affect the audio routing (like a wet/dry mix),
        // we need to rebuild the chain to make sure all connections are correct
        if (paramName === 'Mix') {
          console.log(`Mix parameter changed, rebuilding effect chain to ensure proper routing`);
          this.rebuildEffectChain(trackId);
        }
        
        console.log(`Successfully updated ${effect.type} parameter ${paramName} to ${clampedValue} on track ${trackId}`);
      } catch (error) {
        console.error(`Error applying parameter ${paramName} to ${effect.type} effect:`, error);
      }
      
      // Dispatch event for track changed
      document.dispatchEvent(new CustomEvent('track:changed', {
        detail: { 
          type: 'effect-parameter-changed', 
          trackId, 
          effectId, 
          paramName, 
          value: clampedValue 
        }
      }));
    },
    
    toggleEffectBypass(trackId: string, effectId: string): boolean {
      const track = tracks.get(trackId);
      
      if (!track) {
        console.warn(`Cannot toggle effect: Track ${trackId} not found`);
        return false;
      }
      
      // Find the effect
      const effect = track.effects.find(e => e.id === effectId);
      if (!effect) {
        console.warn(`Effect ${effectId} not found in track ${trackId}`);
        return false;
      }
      
      // Toggle bypass state
      effect.bypass = !effect.bypass;
      
      // Rebuild the effect chain
      this.rebuildEffectChain(trackId);
      
      console.log(`${effect.bypass ? 'Bypassed' : 'Enabled'} ${effect.type} effect on track ${trackId}`);
      
      // Dispatch event for track changed
      document.dispatchEvent(new CustomEvent('track:changed', {
        detail: { 
          type: 'effect-bypass-toggled', 
          trackId, 
          effectId, 
          bypassed: effect.bypass 
        }
      }));
      
      return effect.bypass;
    },
    
    // Apply parameter changes to the actual effect nodes
    applyEffectParameters(effect: Effect): void {
      if (!effect.node) {
        console.warn(`Effect ${effect.id} has no audio node to apply parameters to`);
        return;
      }
      
      try {
        // Apply parameters based on effect type
        switch (effect.type) {
          case 'reverb': {
            // The actual node should be the inputNode from our custom effect
            const inputNode = effect.node;
            
            // Since we now attach methods directly to the input node, we can use them directly
            // This simplifies our parameter application logic
            
            // Get parameters
            const mixParam = effect.parameters.find(p => p.name === 'Mix');
            const timeParam = effect.parameters.find(p => p.name === 'Time');
            
            // First try using direct method access on the input node
            if (mixParam && typeof (inputNode as any).setMix === 'function') {
              console.log(`Updating reverb mix to ${mixParam.value}`);
              (inputNode as any).setMix(mixParam.value);
            } 
            // If that fails, try accessing via the effectObj
            else if (mixParam && (inputNode as any).effectObj && typeof (inputNode as any).effectObj.setMix === 'function') {
              console.log(`Updating reverb mix via effectObj to ${mixParam.value}`);
              (inputNode as any).effectObj.setMix(mixParam.value);
            } 
            else {
              console.warn('Could not update reverb mix - method not available');
            }
            
            // Apply time parameter if it exists and we have the method
            if (timeParam && typeof (inputNode as any).setReverbTime === 'function') {
              console.log(`Updating reverb time to ${timeParam.value}`);
              (inputNode as any).setReverbTime(timeParam.value);
            }
            // If that fails, try accessing via the effectObj
            else if (timeParam && (inputNode as any).effectObj && typeof (inputNode as any).effectObj.setReverbTime === 'function') {
              console.log(`Updating reverb time via effectObj to ${timeParam.value}`);
              (inputNode as any).effectObj.setReverbTime(timeParam.value);
            }
            else {
              console.warn('Could not update reverb time - method not available');
            }
            
            break;
          }
          
          case 'delay': {
            const inputNode = effect.node;
            
            // Find parameters
            const timeParam = effect.parameters.find(p => p.name === 'Time');
            const feedbackParam = effect.parameters.find(p => p.name === 'Feedback');
            const mixParam = effect.parameters.find(p => p.name === 'Mix');
            
            // First try direct method access on the input node
            if (timeParam && typeof (inputNode as any).setDelayTime === 'function') {
              console.log(`Updating delay time to ${timeParam.value}`);
              (inputNode as any).setDelayTime(timeParam.value);
            } 
            // If that fails, try accessing via the effectObj
            else if (timeParam && (inputNode as any).effectObj && typeof (inputNode as any).effectObj.setDelayTime === 'function') {
              console.log(`Updating delay time via effectObj to ${timeParam.value}`);
              (inputNode as any).effectObj.setDelayTime(timeParam.value);
            }
            else {
              console.warn('Could not update delay time - method not available');
            }
            
            if (feedbackParam && typeof (inputNode as any).setFeedback === 'function') {
              console.log(`Updating delay feedback to ${feedbackParam.value}`);
              (inputNode as any).setFeedback(feedbackParam.value);
            }
            // If that fails, try accessing via the effectObj
            else if (feedbackParam && (inputNode as any).effectObj && typeof (inputNode as any).effectObj.setFeedback === 'function') {
              console.log(`Updating delay feedback via effectObj to ${feedbackParam.value}`);
              (inputNode as any).effectObj.setFeedback(feedbackParam.value);
            }
            else {
              console.warn('Could not update delay feedback - method not available');
            }
            
            if (mixParam && typeof (inputNode as any).setMix === 'function') {
              console.log(`Updating delay mix to ${mixParam.value}`);
              (inputNode as any).setMix(mixParam.value);
            }
            // If that fails, try accessing via the effectObj
            else if (mixParam && (inputNode as any).effectObj && typeof (inputNode as any).effectObj.setMix === 'function') {
              console.log(`Updating delay mix via effectObj to ${mixParam.value}`);
              (inputNode as any).effectObj.setMix(mixParam.value);
            }
            else {
              console.warn('Could not update delay mix - method not available');
            }
            
            break;
          }
          
          default:
            console.warn(`Unknown effect type: ${effect.type}`);
        }
      } catch (err) {
        console.error(`Error applying effect parameters for ${effect.type} effect:`, err);
      }
    },
    
    getTrackEffects(trackId: string): Effect[] {
      const track = tracks.get(trackId);
      return track ? [...track.effects] : [];
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
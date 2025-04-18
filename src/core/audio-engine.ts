import { createAudioFileService } from '../services/audio-file-service';
import { createTrackService, TrackService } from '../services/track-service';

export interface AudioEngine {
  audioContext: AudioContext;
  masterGainNode: GainNode;
  trackService: TrackService;
  masterGain: number;
  isPlaying: boolean;
  currentTime: number;
  _activeSources: Array<AudioNode>; // Making this more generic to support OscillatorNode
  startPlayback(startTime?: number): void;
  stopPlayback(): void;
  pausePlayback(): void;
  seekTo(time: number): void;
  exportMix(): Promise<Blob>;
}

export function setupAudioEngine(): AudioEngine {
  // Create audio context
  const audioContext = new AudioContext();
  
  // Create master gain node
  const masterGainNode = audioContext.createGain();
  masterGainNode.connect(audioContext.destination);
  
  // Create track service
  const trackService = createTrackService(audioContext, masterGainNode);
  
  // Create audio file service
  const audioFileService = createAudioFileService(audioContext);
  
  // Track playback state
  let isPlaying = false;
  let playbackStartTime = 0;
  let playbackOffset = 0;
  
  // Active audio sources - can be AudioBufferSourceNode or OscillatorNode
  let activeSources: AudioNode[] = [];
  
  return {
    audioContext,
    masterGainNode,
    trackService,
    _activeSources: activeSources,
    
    get isPlaying(): boolean {
      return isPlaying;
    },
    
    get currentTime(): number {
      if (isPlaying) {
        return audioContext.currentTime - playbackStartTime + playbackOffset;
      }
      return playbackOffset;
    },
    
    get masterGain(): number {
      return masterGainNode.gain.value;
    },
    
    set masterGain(value: number) {
      masterGainNode.gain.value = Math.max(0, Math.min(1, value));
    },
    
    startPlayback(startTime?: number): void {
      console.log('startPlayback called with startTime:', startTime);

      // Resume audio context first (needed for browser autoplay policies)
      if (audioContext.state === 'suspended') {
        console.log('Audio context is suspended, attempting to resume...');
        audioContext.resume()
          .then(() => {
            console.log('Audio context resumed successfully');
            // Try to start playback again after context is resumed
            this.startPlayback(startTime);
          })
          .catch(error => {
            console.error('Failed to resume audio context:', error);
          });
        return;
      }
      
      console.log('Audio context state:', audioContext.state);
      
      // Stop any existing playback
      this.stopPlayback();
      
      // Update playback position if provided
      if (startTime !== undefined) {
        playbackOffset = startTime;
      }
      
      // Set playback state
      isPlaying = true;
      playbackStartTime = audioContext.currentTime;
      
      console.log(`Starting playback at offset ${playbackOffset}s, audioContext.currentTime: ${audioContext.currentTime}`);
      
      // Get all tracks
      const tracks = trackService.getAllTracks();
      console.log(`Playing ${tracks.length} tracks`);

      // Debug: Dump tracks and clips info
      console.log("--- TRACKS DUMP at playback start ---");
      tracks.forEach(track => {
        console.log(`Track ${track.id}: ${track.clips.length} clips, muted: ${track.muted}, solo: ${track.solo}`);
        track.clips.forEach(clip => {
          console.log(`  Clip ${clip.id}: "${clip.name}", startTime: ${clip.startTime}s, duration: ${clip.duration}s, has buffer: ${clip.buffer !== null}`);
          if (clip.buffer) {
            console.log(`    Buffer details: ${clip.buffer.duration}s, ${clip.buffer.numberOfChannels} channels, ${clip.buffer.sampleRate}Hz`);
          }
        });
      });
      
      // Check if we have any tracks to play
      if (tracks.length === 0) {
        console.log('No tracks to play, creating a test tone to verify audio playback');
        // Create a simple oscillator as a test tone
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 440; // A4 note
        gainNode.gain.value = 0.2; // 20% volume
        
        oscillator.connect(gainNode);
        gainNode.connect(masterGainNode);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 1.0); // Play for 1 second
        
        activeSources.push(oscillator);
        console.log('Test tone scheduled');
        return;
      }
      
      let hasClips = false;
      
      // For each track, play all clips that should be heard
      tracks.forEach(track => {
        if (track.muted) {
          console.log(`Track ${track.id} is muted, skipping`);
          return; // Skip muted tracks
        }
        
        // Check if any solo tracks exist; if so, only process solo tracks
        const anySoloActive = tracks.some(t => t.solo);
        if (anySoloActive && !track.solo) {
          console.log(`Track ${track.id} is not solo while solo is active on another track, skipping`);
          return;
        }
        
        // Get the track's gain node
        const trackGainNode = trackService.getTrackGainNode(track.id);
        if (!trackGainNode) {
          console.log(`No gain node found for track ${track.id}, skipping`);
          return;
        }
        
        console.log(`Processing track ${track.id} with ${track.clips.length} clips`);
        
        if (track.clips.length === 0) {
          console.log(`Track ${track.id} has no clips, skipping`);
          return;
        }
        
        // For each clip in the track
        track.clips.forEach(clip => {
          if (!clip.buffer) {
            console.log(`Clip ${clip.id} has no buffer, skipping`);
            return;
          }
          
          // Calculate whether this clip should play now
          const clipStartTime = clip.startTime;
          const clipEndTime = clipStartTime + clip.duration;
          
          console.log(`Clip ${clip.id} spans from ${clipStartTime}s to ${clipEndTime}s, current playback offset is ${playbackOffset}s`);
          
          // Skip clips that have already finished
          if (clipEndTime <= playbackOffset) {
            console.log(`Clip ${clip.id} has already finished (ends at ${clipEndTime}s), skipping`);
            return;
          }
          
          hasClips = true;
          
          // Create a buffer source for this clip
          const source = audioContext.createBufferSource();
          source.buffer = clip.buffer;
          
          // Connect to the track's gain node
          source.connect(trackGainNode);
          
          // Calculate when this clip should start in context time
          let startDelay = clipStartTime - playbackOffset;
          if (startDelay < 0) {
            // We're starting in the middle of this clip
            const offset = -startDelay;
            const duration = clip.duration - offset;
            
            // Only play if there's still something left to play
            if (duration <= 0) {
              console.log(`Clip ${clip.id} has no duration left to play, skipping`);
              return;
            }
            
            console.log(`Starting clip ${clip.id} immediately at offset ${offset}s, duration ${duration}s`);
            try {
              source.start(0, offset, duration);
              console.log(`Clip ${clip.id} started successfully`);
            } catch (error) {
              console.error(`Error starting clip ${clip.id}:`, error);
            }
          } else {
            // This clip starts in the future
            console.log(`Scheduling clip ${clip.id} to start in ${startDelay}s (at ${audioContext.currentTime + startDelay}s context time), duration ${clip.duration}s`);
            try {
              source.start(audioContext.currentTime + startDelay, 0, clip.duration);
              console.log(`Clip ${clip.id} scheduled successfully`);
            } catch (error) {
              console.error(`Error scheduling clip ${clip.id}:`, error);
            }
          }
          
          // Keep track of this source for stopping later
          activeSources.push(source);
        });
      });
      
      if (!hasClips) {
        console.log('No clips found that can be played at the current playback position');
        console.log(`Current playback offset: ${playbackOffset}s`);
        
        // Look for clips that might be positioned further in the timeline
        let futureClipsExist = false;
        tracks.forEach(track => {
          if (!track.muted) {
            track.clips.forEach(clip => {
              if (clip.buffer && clip.startTime > playbackOffset) {
                console.log(`Found future clip "${clip.name}" at ${clip.startTime}s (current position: ${playbackOffset}s)`);
                futureClipsExist = true;
              }
            });
          }
        });
        
        if (futureClipsExist) {
          console.log('Some clips exist in the future. Try seeking to a position where clips exist.');
        } else {
          console.log('No clips to play, creating a test tone to verify audio playback');
          // Create a simple oscillator as a test tone
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.type = 'sine';
          oscillator.frequency.value = 440; // A4 note
          gainNode.gain.value = 0.2; // 20% volume
          
          oscillator.connect(gainNode);
          gainNode.connect(masterGainNode);
          
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 1.0); // Play for 1 second
          
          activeSources.push(oscillator);
          console.log('Test tone scheduled');
        }
      }
      
      console.log(`Playback started with ${activeSources.length} active sources`);
    },
    
    stopPlayback(): void {
      console.log('stopPlayback called, isPlaying:', isPlaying);
      
      if (!isPlaying) {
        console.log('Not currently playing, nothing to stop');
        return;
      }
      
      isPlaying = false;
      playbackOffset = 0;
      
      // Stop all active sources
      console.log(`Stopping ${activeSources.length} active sources`);
      activeSources.forEach((source, index) => {
        try {
          console.log(`Stopping source ${index}`);
          // Check if the source is an AudioScheduledSourceNode which has a stop method
          if ('stop' in source) {
            (source as AudioScheduledSourceNode).stop();
            console.log(`Source ${index} stopped successfully`);
          } else {
            console.log(`Source ${index} doesn't have a stop method`);
          }
        } catch (e) {
          console.warn(`Error stopping source ${index}:`, e);
          // Ignore errors from already stopped sources
        }
      });
      
      // Clear active sources
      activeSources = [];
      
      console.log('Playback stopped, all sources cleared');
    },
    
    pausePlayback(): void {
      if (!isPlaying) return;
      
      isPlaying = false;
      
      // Calculate current position
      playbackOffset = audioContext.currentTime - playbackStartTime + playbackOffset;
      
      // Stop all active sources
      console.log(`Pausing playback, stopping ${activeSources.length} active sources`);
      activeSources.forEach((source, index) => {
        try {
          // Check if the source is an AudioScheduledSourceNode which has a stop method
          if ('stop' in source) {
            (source as AudioScheduledSourceNode).stop();
            console.log(`Source ${index} stopped during pause`);
          } else {
            console.log(`Source ${index} doesn't have a stop method (pause)`);
          }
        } catch (e) {
          console.warn(`Error stopping source ${index} during pause:`, e);
          // Ignore errors from already stopped sources
        }
      });
      
      // Clear active sources
      activeSources = [];
      
      console.log(`Playback paused at ${playbackOffset}s`);
    },
    
    seekTo(time: number): void {
      const wasPlaying = isPlaying;
      
      // If currently playing, stop first
      if (isPlaying) {
        this.pausePlayback();
      }
      
      // Update playback position
      playbackOffset = Math.max(0, time);
      
      // If was playing, restart from new position
      if (wasPlaying) {
        this.startPlayback();
      }
      
      console.log(`Seeked to ${playbackOffset}s`);
    },
    
    async exportMix(): Promise<Blob> {
      // Get all tracks
      const tracks = trackService.getAllTracks();
      
      // Find the longest duration
      let maxDuration = 0;
      
      tracks.forEach(track => {
        track.clips.forEach(clip => {
          const clipEndTime = clip.startTime + clip.duration;
          if (clipEndTime > maxDuration) {
            maxDuration = clipEndTime;
          }
        });
      });
      
      // Add a bit of padding
      maxDuration += 1;
      
      // Create an offline audio context for rendering
      const offlineCtx = new OfflineAudioContext(
        2, // stereo output
        Math.ceil(maxDuration * audioContext.sampleRate), // duration in samples
        audioContext.sampleRate
      );
      
      // Create a master gain for the offline context
      const offlineMasterGain = offlineCtx.createGain();
      offlineMasterGain.connect(offlineCtx.destination);
      
      // For each track, schedule all clips
      const trackPromises = tracks.map(track => {
        // Create a gain node for this track
        const trackGain = offlineCtx.createGain();
        trackGain.gain.value = track.gainValue;
        trackGain.connect(offlineMasterGain);
        
        // Apply mute/solo
        if (track.muted) {
          trackGain.gain.value = 0;
        }
        
        // Schedule all clips on this track
        return Promise.all(track.clips.map(clip => {
          if (!clip.buffer) return Promise.resolve();
          
          // Create a buffer source
          const source = offlineCtx.createBufferSource();
          source.buffer = clip.buffer;
          
          // Connect to the track gain
          source.connect(trackGain);
          
          // Start at the appropriate time
          source.start(clip.startTime, clip.offset, clip.duration);
          
          return Promise.resolve();
        }));
      });
      
      // Wait for all tracks to be scheduled
      await Promise.all(trackPromises);
      
      // Render the audio
      const renderedBuffer = await offlineCtx.startRendering();
      
      // Convert to WAV
      console.log('Export completed');
      
      // Use the audio file service to create a WAV blob
      return audioFileService.exportAudioBuffer(renderedBuffer, 'daw-export.wav');
    }
  };
}
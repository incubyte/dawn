import { AudioClip } from '../models/audio-clip';
import { TrackService } from './track-service';
import JSZip from 'jszip';

// Define a serializable project format
export interface SerializableProject {
  version: string;
  name: string;
  tracks: SerializableTrack[];
  createdAt: string;
  updatedAt: string;
}

export interface SerializableTrack {
  id: string;
  gainValue: number;
  muted: boolean;
  solo: boolean;
  clips: SerializableClip[];
}

export interface SerializableClip {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  offset: number;
  audioFileName: string; // Reference to the separate audio file
}

export interface ProjectService {
  saveProject(name: string): Promise<Blob>;
  loadProject(file: File): Promise<boolean>;
  getProjectAsJSON(): Promise<SerializableProject>;
  getCurrentProjectName(): string | null;
  getOriginalFileName(): string | null;
  hasUnsavedChanges(): boolean;
}

export function createProjectService(
  audioContext: AudioContext, 
  trackService: TrackService
): ProjectService {
  let currentProjectName: string | null = null;
  let originalFileName: string | null = null;
  let lastSavedState: string | null = null;
  
  // Function to update the last saved state
  const updateLastSavedState = async () => {
    try {
      const project = await getProjectAsJSONInternal();
      lastSavedState = JSON.stringify(project);
    } catch (error) {
      console.error('Error updating last saved state:', error);
    }
  };
  
  // Internal version of getProjectAsJSON to avoid circular references
  const getProjectAsJSONInternal = async (): Promise<SerializableProject> => {
    const tracks = trackService.getAllTracks();
    const serializedTracks: SerializableTrack[] = [];
    
    for (const track of tracks) {
      const serializedClips: SerializableClip[] = [];
      
      for (const clip of track.clips) {
        // Create a serializable clip
        const serializedClip: SerializableClip = {
          id: clip.id,
          name: clip.name,
          startTime: clip.startTime,
          duration: clip.duration,
          offset: clip.offset,
          audioFileName: `${clip.id}.wav` // Reference to the audio file
        };
        
        serializedClips.push(serializedClip);
      }
      
      // Create a serializable track
      const serializedTrack: SerializableTrack = {
        id: track.id,
        gainValue: track.gainValue,
        muted: track.muted,
        solo: track.solo,
        clips: serializedClips
      };
      
      serializedTracks.push(serializedTrack);
    }
    
    // Create the project object
    const projectName = currentProjectName || 'Untitled Project';
    const now = new Date().toISOString();
    
    const project: SerializableProject = {
      version: '1.0',
      name: projectName,
      tracks: serializedTracks,
      createdAt: now,
      updatedAt: now
    };
    
    return project;
  };
  
  // Listen for track changes to detect unsaved changes
  document.addEventListener('track:changed', () => {
    console.log('Track changed event detected, project now has unsaved changes');
  });
  
  // Listen for clip changes to detect unsaved changes
  document.addEventListener('clip:changed', () => {
    console.log('Clip changed event detected, project now has unsaved changes');
  });
  
  return {
    /**
     * Save the current project to a zip file containing the project JSON and audio files
     */
    async saveProject(name: string): Promise<Blob> {
      currentProjectName = name;
      console.log(`Saving project: ${name}`);
      
      // Create a new zip file
      const zip = new JSZip();
      
      // Get the project data
      const project = await getProjectAsJSONInternal();
      
      // Add the project JSON to the zip
      zip.file("project.json", JSON.stringify(project, null, 2));
      
      // Create audio folder
      const audioFolder = zip.folder("audio");
      if (!audioFolder) {
        throw new Error("Failed to create audio folder in zip file");
      }
      
      // Add all audio files to the zip
      const tracks = trackService.getAllTracks();
      for (const track of tracks) {
        for (const clip of track.clips) {
          if (clip.buffer) {
            try {
              console.log(`Saving audio clip: ${clip.name} (${clip.id})`);
              
              // Convert audio buffer to WAV format
              const wavBlob = await audioBufferToWavBlob(clip.buffer);
              console.log(`Created WAV blob: ${wavBlob.size} bytes`);
              
              // Add the audio file to the zip with explicit blob handling
              const arrayBuffer = await wavBlob.arrayBuffer();
              audioFolder.file(`${clip.id}.wav`, arrayBuffer);
              
              console.log(`Added audio file to zip: audio/${clip.id}.wav (${arrayBuffer.byteLength} bytes)`);
            } catch (error) {
              console.error(`Failed to encode audio for clip ${clip.name}:`, error);
            }
          } else {
            console.warn(`Clip ${clip.name} has no audio buffer to save`);
          }
        }
      }
      
      // Generate the zip file with verbose logging
      console.log('Generating zip file...');
      
      // Log all the files we're adding to the zip
      let fileCount = 0;
      Object.keys(zip.files).forEach(filename => {
        fileCount++;
        console.log(`Zip contains: ${filename} (${zip.files[filename].dir ? 'directory' : 'file'})`);
      });
      console.log(`Total files in zip: ${fileCount}`);
      
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
      
      // Update the last saved state
      await updateLastSavedState();
      
      console.log(`Generated zip file: ${zipBlob.size} bytes`);
      return zipBlob;
    },
    
    /**
     * Load a project from a zip file
     */
    async loadProject(file: File): Promise<boolean> {
      try {
        console.log(`Loading project from file: ${file.name}`);
        
        // Store the original file name
        originalFileName = file.name;
        
        // Load the zip file
        const zip = new JSZip();
        console.log(`Loading zip file: ${file.name} (${file.size} bytes)`);
        const zipContents = await zip.loadAsync(file);
        
        // Log the zip contents for debugging
        console.log('Zip contents:');
        Object.keys(zipContents.files).forEach(filename => {
          console.log(`- ${filename} (${zipContents.files[filename].dir ? 'directory' : 'file'})`);
        });
        
        // Extract the project JSON
        const projectFile = zipContents.file("project.json");
        if (!projectFile) {
          throw new Error("Invalid project file: no project.json found");
        }
        
        const projectJson = await projectFile.async("text");
        const project = JSON.parse(projectJson) as SerializableProject;
        
        // Validate project structure
        if (!project.version || !project.tracks) {
          throw new Error('Invalid project file format');
        }
        
        console.log(`Project version: ${project.version}`);
        console.log(`Project contains ${project.tracks.length} tracks`);
        
        // Clear existing tracks
        const existingTracks = trackService.getAllTracks();
        existingTracks.forEach(track => {
          trackService.removeTrack(track.id);
        });
        
        // Load the tracks and clips
        for (const serializedTrack of project.tracks) {
          console.log(`Loading track: ${serializedTrack.id}`);
          
          // Create a new track with the same ID
          const track = trackService.addTrack(serializedTrack.id);
          
          // Apply track settings
          trackService.setTrackVolume(track.id, serializedTrack.gainValue);
          if (serializedTrack.muted) trackService.toggleMute(track.id);
          if (serializedTrack.solo) trackService.toggleSolo(track.id);
          
          // Load clips for this track
          for (const serializedClip of serializedTrack.clips) {
            console.log(`Loading clip: ${serializedClip.name}`);
            
            try {
              // Try multiple possible paths to find the audio file
              const possiblePaths = [
                `audio/${serializedClip.audioFileName}`,
                `audio/${serializedClip.id}.wav`,
                serializedClip.audioFileName,
                `${serializedClip.id}.wav`
              ];
              
              console.log(`Looking for audio file for clip: ${serializedClip.name} (${serializedClip.id})`);
              
              // Find the first valid audio file
              let audioFile = null;
              for (const path of possiblePaths) {
                console.log(`Trying path: ${path}`);
                audioFile = zipContents.file(path);
                if (audioFile) {
                  console.log(`Found audio file at path: ${path}`);
                  break;
                }
              }
              
              if (!audioFile) {
                console.warn(`Audio file not found for clip: ${serializedClip.name} after trying multiple paths`);
                console.log('Available files in zip:');
                Object.keys(zipContents.files).forEach(filename => {
                  console.log(`- ${filename}`);
                });
                continue;
              }
              
              // Extract the audio data as an array buffer
              const audioData = await audioFile.async("arraybuffer");
              console.log(`Extracted audio data: ${audioData.byteLength} bytes`);
              
              // Decode the audio data
              console.log(`Decoding audio data for clip: ${serializedClip.name}`);
              const audioBuffer = await decodeAudioData(audioData, audioContext);
              console.log(`Decoded audio buffer: ${audioBuffer.duration}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`);
              
              // Create the clip with the audio buffer
              const clip: AudioClip = {
                id: serializedClip.id,
                buffer: audioBuffer,
                startTime: serializedClip.startTime,
                duration: serializedClip.duration,
                offset: serializedClip.offset,
                name: serializedClip.name
              };
              
              trackService.addClipToTrack(track.id, clip);
            } catch (error) {
              console.error(`Failed to load audio for clip ${serializedClip.name}:`, error);
            }
          }
        }
        
        // Update the current project name
        currentProjectName = project.name;
        
        // Update the last saved state
        await updateLastSavedState();
        
        // Dispatch an event to notify UI components
        document.dispatchEvent(new CustomEvent('project:loaded', {
          detail: { 
            name: project.name,
            fileName: originalFileName 
          }
        }));
        
        return true;
      } catch (error) {
        console.error('Error loading project:', error);
        // Reset state on error
        originalFileName = null;
        return false;
      }
    },
    
    /**
     * Get the current project as a serializable JSON object
     */
    async getProjectAsJSON(): Promise<SerializableProject> {
      return getProjectAsJSONInternal();
    },
    
    /**
     * Get the current project name
     */
    getCurrentProjectName(): string | null {
      return currentProjectName;
    },
    
    /**
     * Get the original file name that was loaded
     */
    getOriginalFileName(): string | null {
      return originalFileName;
    },
    
    /**
     * Check if there are unsaved changes
     */
    hasUnsavedChanges(): boolean {
      // If no project has been loaded or saved yet, consider it unsaved
      if (!lastSavedState) return true;
      
      // Simplified implementation - in a real app, this would compare the current state
      // with the lastSavedState to determine if changes have been made
      return true;
    }
  };
}

/**
 * Convert an AudioBuffer to a WAV Blob
 */
async function audioBufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Converting AudioBuffer to WAV: ${buffer.duration}s, ${buffer.numberOfChannels} channels, ${buffer.sampleRate}Hz`);
      
      // Convert directly to WAV format
      const wavArrayBuffer = audioBufferToWav(buffer);
      console.log(`Converted to WAV, size: ${wavArrayBuffer.byteLength} bytes`);
      
      // Create a Blob with explicit MIME type
      const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
      console.log(`Created WAV Blob, size: ${blob.size} bytes`);
      
      resolve(blob);
    } catch (error) {
      console.error('Error converting buffer to WAV:', error);
      reject(error);
    }
  });
}

/**
 * Decode audio data from an ArrayBuffer
 */
async function decodeAudioData(arrayBuffer: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try {
      audioContext.decodeAudioData(
        arrayBuffer,
        buffer => resolve(buffer),
        error => reject(error)
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Convert an AudioBuffer to WAV format
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM format
  const bitDepth = 16; // 16-bit audio
  
  // Calculate sizes
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44; // WAV header size
  const totalSize = headerSize + dataSize;
  
  // Create buffer
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);
  
  // Write WAV header
  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  
  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // 16 bytes for fmt chunk
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  
  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write audio data
  const channels = [];
  for (let i = 0; i < numOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  const samples = buffer.length;
  
  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < numOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i])); 
      const value = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
      view.setInt16(offset, value, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
}

// Helper to write strings to DataView
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
import { decodeAudioData } from '../utils/audio-decoder';

export interface AudioFileService {
  loadAudioFile(file: File): Promise<AudioBuffer>;
  exportAudioBuffer(buffer: AudioBuffer, filename: string): Blob;
}

export function createAudioFileService(audioContext: AudioContext): AudioFileService {
  return {
    async loadAudioFile(file: File): Promise<AudioBuffer> {
      console.log(`Loading file: ${file.name}, type: ${file.type || 'unknown'}, size: ${file.size} bytes`);
      
      // Validate file type
      let isSupported = false;
      
      // Check by MIME type
      if (file.type.startsWith('audio/')) {
        isSupported = true;
      }
      
      // Also check by extension (browsers sometimes don't set MIME type correctly)
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const supportedExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
      if (fileExtension && supportedExtensions.includes(fileExtension)) {
        isSupported = true;
      }
      
      if (!isSupported) {
        console.warn(`File type may not be supported: ${file.type || 'unknown type'}, extension: ${fileExtension || 'none'}`);
      }
      
      // Special handling for MP3 files to provide better error messages
      const isMP3 = file.type === 'audio/mp3' || file.type === 'audio/mpeg' || (fileExtension === 'mp3');
      if (isMP3) {
        console.log('MP3 file detected, will attempt to decode');
      }
      
      try {
        // Ensure the audio context is running
        if (audioContext.state === 'suspended') {
          console.log('Resuming audio context for decoding');
          try {
            await audioContext.resume();
            console.log('Audio context resumed successfully');
          } catch (resumeError) {
            console.error('Failed to resume audio context:', resumeError);
            // Continue anyway - decodeAudioData will try again if needed
          }
        }
        
        console.log(`Audio context state: ${audioContext.state}`);
        
        // Read the file as an ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        console.log(`File loaded as ArrayBuffer, size: ${arrayBuffer.byteLength} bytes`);
        
        if (arrayBuffer.byteLength === 0) {
          throw new Error('File is empty (0 bytes)');
        }
        
        // Try to decode the audio using enhanced decoder with fallbacks
        try {
          // Use our custom decoder with fallbacks for different formats
          console.log('Sending to decodeAudioData...');
          const audioBuffer = await decodeAudioData(arrayBuffer, file, audioContext);
          
          // Validate the resulting audio buffer
          if (!audioBuffer || audioBuffer.length === 0 || audioBuffer.numberOfChannels === 0) {
            throw new Error('Decoder returned an invalid or empty AudioBuffer');
          }
          
          console.log(`Audio decoded successfully: ${audioBuffer.duration}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`);
          
          // Additional test - check that the buffer contains actual audio data
          const channelData = audioBuffer.getChannelData(0);
          let hasAudioData = false;
          
          // Check the first 1000 samples (or all if fewer) to see if any are non-zero
          for (let i = 0; i < Math.min(1000, channelData.length); i++) {
            if (channelData[i] !== 0) {
              hasAudioData = true;
              break;
            }
          }
          
          if (!hasAudioData) {
            console.warn('AudioBuffer may contain silent audio (all zeros in sample check)');
          }
          
          return audioBuffer;
        } catch (decodeError: any) {
          console.error('Error decoding audio data:', decodeError);
          
          if (isMP3) {
            // Provide more specific error for MP3
            throw new Error(`Failed to decode MP3 file: ${decodeError?.message || 'Unknown error'}`);
          } else {
            throw new Error(`Failed to decode audio file: ${decodeError?.message || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error('Error loading audio file:', error);
        throw error;
      }
    },
    
    exportAudioBuffer(buffer: AudioBuffer, filename: string): Blob {
      console.log(`Exporting audio buffer: ${buffer.duration}s, ${buffer.numberOfChannels} channels`);
      
      // Convert AudioBuffer to WAV format
      const wav = audioBufferToWav(buffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename.endsWith('.wav') ? filename : `${filename}.wav`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      return blob;
    }
  };
}

// Helper function to convert AudioBuffer to WAV format
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
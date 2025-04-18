export interface AudioFileService {
  loadAudioFile(file: File): Promise<AudioBuffer>;
  exportAudioBuffer(buffer: AudioBuffer, filename: string): void;
}

export function createAudioFileService(audioContext: AudioContext): AudioFileService {
  return {
    async loadAudioFile(file: File): Promise<AudioBuffer> {
      const arrayBuffer = await file.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer);
    },
    
    exportAudioBuffer(buffer: AudioBuffer, filename: string): void {
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
    }
  };
}

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  // This is a simplified implementation - a real one would need more details
  // For a real implementation, consider using a library like wavefile or audiobuffer-to-wav
  
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
  const scale = 0x7FFF; // for 16-bit
  
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

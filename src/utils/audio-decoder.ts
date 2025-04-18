/**
 * Audio decoder utility to help with different audio formats
 */

import { MPEGDecoder } from 'mpg123-decoder';

/**
 * Specialized decoder for MP3 files using the mpg123-decoder library
 * This helps in browsers with limited MP3 support
 */
export async function decodeMP3(arrayBuffer: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
  try {
    console.log('Attempting to decode MP3 using mpg123-decoder');
    
    // Initialize the decoder
    const decoder = new MPEGDecoder();
    await decoder.ready;
    
    // Decode the MP3 file
    const decodedData = decoder.decode(new Uint8Array(arrayBuffer));
    
    // Get the decoded PCM data
    const pcmData = decodedData.channelData;
    const numChannels = pcmData.length;
    const sampleRate = decodedData.sampleRate;
    
    console.log(`MP3 decoded: ${numChannels} channels, ${sampleRate}Hz, ${pcmData.length} samples`);
    
    // Create an audio buffer from the decoded PCM data
    const audioBuffer = audioContext.createBuffer(
      numChannels,
      pcmData.length / numChannels,
      sampleRate
    );
    
    // Copy the PCM data to the audio buffer
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const sourceData = pcmData[channel];
      
      // Copy the channel data
      channelData.set(sourceData);
    }
    
    // Clean up
    decoder.free();
    
    return audioBuffer;
  } catch (error) {
    console.error('Error decoding MP3 with mpg123-decoder:', error);
    throw new Error(`MP3 decoding failed with library: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Attempts to decode audio data using multiple methods
 * Falls back to specialized decoders if the browser's built-in decoder fails
 */
export async function decodeAudioData(arrayBuffer: ArrayBuffer, file: File, audioContext: AudioContext): Promise<AudioBuffer> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const isMP3 = file.type === 'audio/mp3' || file.type === 'audio/mpeg' || (fileExtension === 'mp3');
  
  try {
    // First try with the browser's built-in decoder
    console.log('Attempting to decode with browser\'s native decoder');
    try {
      return await audioContext.decodeAudioData(arrayBuffer);
    } catch (nativeError) {
      console.warn('Browser native decoding failed:', nativeError);
      
      // For MP3 files, try with the specialized MP3 decoder
      if (isMP3) {
        console.log('Falling back to MP3 specialized decoder');
        return await decodeMP3(arrayBuffer, audioContext);
      }
      
      // For other formats, just rethrow the error
      throw nativeError;
    }
  } catch (error) {
    console.error('All decoding methods failed:', error);
    throw new Error(`Failed to decode audio file: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/**
 * Audio decoder utility to help with different audio formats
 */

import { MPEGDecoder } from 'mpg123-decoder';

// Flag to track if we've already logged important debugging info
let hasLoggedDecoderInfo = false;

/**
 * Specialized decoder for MP3 files using the mpg123-decoder library
 * This helps in browsers with limited MP3 support
 */
export async function decodeMP3(arrayBuffer: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
  try {
    console.log('Attempting to decode MP3 using mpg123-decoder');
    
    if (!hasLoggedDecoderInfo) {
      console.log('MPEGDecoder version:', MPEGDecoder.version);
      hasLoggedDecoderInfo = true;
    }
    
    // Create a clone of the array buffer to avoid any issues with the original being detached
    const clonedBuffer = arrayBuffer.slice(0);
    
    // Initialize the decoder with explicit wait for ready
    const decoder = new MPEGDecoder();
    console.log('Waiting for decoder to be ready...');
    await decoder.ready;
    console.log('Decoder is ready');
    
    // Decode the MP3 file
    console.log('Starting MP3 decoding...');
    const decodedData = decoder.decode(new Uint8Array(clonedBuffer));
    console.log('MP3 decoding completed successfully');
    
    // Get the decoded PCM data
    const pcmData = decodedData.channelData;
    const numChannels = pcmData.length;
    const sampleRate = decodedData.sampleRate;
    const numSamples = pcmData[0].length;
    
    console.log(`MP3 decoded: ${numChannels} channels, ${sampleRate}Hz, ${numSamples} samples per channel`);
    
    // Create an audio buffer from the decoded PCM data
    const audioBuffer = audioContext.createBuffer(
      numChannels,
      numSamples,
      sampleRate
    );
    
    // Copy the PCM data to the audio buffer
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const sourceData = pcmData[channel];
      
      // Verify we have data in the channel
      if (sourceData && sourceData.length > 0) {
        console.log(`Channel ${channel} has ${sourceData.length} samples`);
        
        // Copy the channel data
        channelData.set(sourceData);
      } else {
        console.error(`Channel ${channel} has no data`);
      }
    }
    
    // Clean up
    console.log('Freeing decoder resources');
    decoder.free();
    
    console.log(`Successfully created AudioBuffer: ${audioBuffer.duration}s, ${audioBuffer.numberOfChannels} channels`);
    return audioBuffer;
  } catch (error) {
    console.error('Error decoding MP3 with mpg123-decoder:', error);
    
    // Try to provide more detailed error information
    let errorDetails = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    throw new Error(`MP3 decoding failed with library: ${errorDetails}`);
  }
}

/**
 * Attempts to decode audio data using multiple methods
 * Falls back to specialized decoders if the browser's built-in decoder fails
 */
export async function decodeAudioData(arrayBuffer: ArrayBuffer, file: File, audioContext: AudioContext): Promise<AudioBuffer> {
  // Log file information
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const isMP3 = file.type === 'audio/mp3' || file.type === 'audio/mpeg' || (fileExtension === 'mp3');
  
  console.log(`Decoding file: ${file.name}, type: ${file.type}, size: ${arrayBuffer.byteLength} bytes`);
  console.log(`File is ${isMP3 ? 'identified as' : 'not'} an MP3 file`);
  
  try {
    // First try with the browser's built-in decoder
    console.log('Attempting to decode with browser\'s native decoder');
    try {
      // Create a promise with a timeout for the native decoder
      const nativeDecodePromise = new Promise<AudioBuffer>((resolve, reject) => {
        audioContext.decodeAudioData(
          arrayBuffer.slice(0), // Use a clone of the buffer
          (decodedData) => {
            console.log('Native decoder succeeded');
            resolve(decodedData);
          },
          (error) => {
            console.warn('Native decoder failed:', error);
            reject(error);
          }
        );
      });
      
      // Add a timeout to the native decoder to avoid hanging
      const timeoutPromise = new Promise<AudioBuffer>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Native decoder timeout after 5 seconds'));
        }, 5000);
      });
      
      return await Promise.race([nativeDecodePromise, timeoutPromise]);
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
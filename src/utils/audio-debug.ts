// Audio debugging utilities
import { showErrorNotification } from '../ui/components/loading';

let audioEngine: any = null;

export function setupAudioDebug(engine: any): void {
  // Store the audio engine reference
  audioEngine = engine;
  
  // Set up the debug controls
  const debugPanel = document.getElementById('audio-debug');
  const audioContextStateElem = document.getElementById('audio-context-state');
  const activeSourcesCountElem = document.getElementById('active-sources-count');
  const testToneButton = document.getElementById('debug-test-tone');
  const showDebugLogsCheckbox = document.getElementById('show-debug-logs') as HTMLInputElement;
  
  if (!debugPanel || !audioContextStateElem || !activeSourcesCountElem || !testToneButton || !showDebugLogsCheckbox) {
    console.warn('Audio debug elements not found in the DOM');
    return;
  }
  
  // Initialize UI
  updateDebugInfo();
  
  // Set up periodic updates
  setInterval(updateDebugInfo, 1000);
  
  // Set up debug panel toggle and show it by default to help with debugging
  showDebugLogsCheckbox.checked = true;
  debugPanel.style.display = 'block';
  
  showDebugLogsCheckbox.addEventListener('change', () => {
    debugPanel.style.display = showDebugLogsCheckbox.checked ? 'block' : 'none';
  });
  
  // Add Resume Audio Context button functionality
  const resumeAudioButton = document.getElementById('debug-resume-audio');
  if (resumeAudioButton) {
    resumeAudioButton.addEventListener('click', async () => {
      if (!audioEngine || !audioEngine.audioContext) {
        console.error('Audio engine or audio context not available');
        return;
      }
      
      try {
        console.log('Manually resuming audio context...');
        await audioEngine.audioContext.resume();
        console.log('Audio context resumed manually');
        updateDebugInfo();
        // Add visual feedback
        resumeAudioButton.textContent = 'Audio Context Resumed';
        resumeAudioButton.style.backgroundColor = '#4CAF50';
        setTimeout(() => {
          resumeAudioButton.textContent = 'Resume Audio Context';
          resumeAudioButton.style.backgroundColor = '';
        }, 2000);
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        resumeAudioButton.textContent = 'Resume Failed';
        resumeAudioButton.style.backgroundColor = '#F44336';
        setTimeout(() => {
          resumeAudioButton.textContent = 'Resume Audio Context';
          resumeAudioButton.style.backgroundColor = '';
        }, 2000);
      }
    });
  }
  
  // Add MP3 decoder status check
  const mp3DecoderStatus = document.getElementById('mp3-decoder-status');
  if (mp3DecoderStatus) {
    checkMP3DecoderStatus(mp3DecoderStatus);
  }
  
  // Add a track info section
  const trackInfo = document.createElement('div');
  trackInfo.innerHTML = '<div style="margin-top: 10px;">Track Info: <span id="track-count">0</span> tracks, <span id="clip-count">0</span> clips</div>';
  debugPanel.appendChild(trackInfo);
  
  // Update track info every second
  setInterval(() => {
    if (!audioEngine || !audioEngine.trackService) return;
    
    const tracks = audioEngine.trackService.getAllTracks();
    const trackCountEl = document.getElementById('track-count');
    const clipCountEl = document.getElementById('clip-count');
    
    if (trackCountEl) {
      trackCountEl.textContent = tracks.length.toString();
    }
    
    if (clipCountEl) {
      let clipCount = 0;
      tracks.forEach((track: { clips: any[] }) => {
        clipCount += track.clips.length;
      });
      clipCountEl.textContent = clipCount.toString();
    }
  }, 1000);
  
  // Set up test tone button
  testToneButton.addEventListener('click', () => {
    playTestTone();
  });
  
  // Add a button to check loaded clips
  const checkClipsButton = document.createElement('button');
  checkClipsButton.textContent = 'Check Clips';
  checkClipsButton.style.marginTop = '5px';
  checkClipsButton.style.marginLeft = '5px';
  debugPanel.appendChild(checkClipsButton);
  
  // Add button to test MP3 support
  const testMP3Button = document.createElement('button');
  testMP3Button.textContent = 'Test MP3 Support';
  testMP3Button.style.marginTop = '5px';
  testMP3Button.style.marginLeft = '5px';
  debugPanel.appendChild(testMP3Button);
  
  // Add event listener for the MP3 test button
  testMP3Button.addEventListener('click', async () => {
    try {
      console.log('Testing MP3 decoding support...');
      const statusElement = document.createElement('div');
      statusElement.style.marginTop = '10px';
      statusElement.style.color = 'yellow';
      statusElement.textContent = 'Testing MP3 support...';
      debugPanel.appendChild(statusElement);
      
      // First test with native decoding
      statusElement.textContent = 'Testing native browser MP3 decoding...';
      
      try {
        // Create a small test MP3 (header only, not real audio)
        const testMP3 = new Uint8Array([
          0xFF, 0xFB, 0x50, 0x00, 0x00, 0x00, 0x00, 0x00, 
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        
        const audioContext = new AudioContext();
        await audioContext.decodeAudioData(testMP3.buffer).then(() => {
          statusElement.textContent = '✓ Your browser supports native MP3 decoding';
          statusElement.style.color = '#4CAF50';
        }).catch(err => {
          statusElement.textContent = '✗ Native MP3 decoding failed: ' + err.message;
          statusElement.style.color = 'orange';
        });
      } catch (error) {
        statusElement.textContent = '✗ Native MP3 test error: ' + (error instanceof Error ? error.message : String(error));
        statusElement.style.color = '#F44336';
      }
      
      // Add another status for the library test
      const libStatusElement = document.createElement('div');
      libStatusElement.style.marginTop = '5px';
      libStatusElement.style.color = 'yellow';
      libStatusElement.textContent = 'Testing mpg123-decoder library...';
      debugPanel.appendChild(libStatusElement);
      
      try {
        // Dynamic import the decoder
        const { MPEGDecoder } = await import('mpg123-decoder');
        const decoder = new MPEGDecoder();
        await decoder.ready;
        libStatusElement.textContent = '✓ MP3 decoder library loaded successfully';
        libStatusElement.style.color = '#4CAF50';
        decoder.free();
      } catch (error) {
        libStatusElement.textContent = '✗ MP3 decoder library failed: ' + (error instanceof Error ? error.message : String(error));
        libStatusElement.style.color = '#F44336';
      }
      
      // Summary 
      const summaryElement = document.createElement('div');
      summaryElement.style.marginTop = '10px';
      summaryElement.style.fontWeight = 'bold';
      summaryElement.textContent = 'MP3 files should work on this browser';
      debugPanel.appendChild(summaryElement);
      
    } catch (error) {
      console.error('Error testing MP3 support:', error);
      showErrorNotification('Error testing MP3 support: ' + (error instanceof Error ? error.message : String(error)));
    }
  });
  
  checkClipsButton.addEventListener('click', () => {
    if (!audioEngine || !audioEngine.trackService) {
      console.log('Audio engine or track service not available');
      return;
    }
    
    const tracks = audioEngine.trackService.getAllTracks();
    console.log(`Found ${tracks.length} tracks:`);
    
    tracks.forEach((track: { id: string, clips: any[], muted: boolean, solo: boolean }) => {
      console.log(`Track ${track.id}: ${track.clips.length} clips, muted: ${track.muted}, solo: ${track.solo}`);
      
      if (track.clips.length > 0) {
        track.clips.forEach((clip: { id: string, name: string, startTime: number, duration: number, buffer: AudioBuffer | null }) => {
          console.log(`  Clip ${clip.id}: "${clip.name}", startTime: ${clip.startTime}s, duration: ${clip.duration}s, has buffer: ${clip.buffer !== null}`);
          if (clip.buffer) {
            console.log(`    Buffer details: ${clip.buffer.duration}s, ${clip.buffer.numberOfChannels} channels, ${clip.buffer.sampleRate}Hz`);
          }
        });
      }
    });
  });
  
  function updateDebugInfo() {
    if (!audioEngine || !audioEngine.audioContext || !audioContextStateElem || !activeSourcesCountElem) {
      if (audioContextStateElem) {
        audioContextStateElem.textContent = 'Not available';
      }
      return;
    }
    
    // Update audio context state
    audioContextStateElem.textContent = audioEngine.audioContext.state;
    
    // Update active sources count
    const activeSources = (audioEngine as any)._activeSources || [];
    activeSourcesCountElem.textContent = activeSources.length.toString();
    
    // Colorize based on state
    if (audioEngine.audioContext.state === 'running') {
      audioContextStateElem.style.color = '#4CAF50'; // Green
    } else if (audioEngine.audioContext.state === 'suspended') {
      audioContextStateElem.style.color = '#FFC107'; // Yellow
    } else {
      audioContextStateElem.style.color = '#F44336'; // Red
    }
  }
  
  function playTestTone() {
    console.log('Playing test tone...');
    
    if (!audioEngine || !audioEngine.audioContext) {
      console.error('Audio engine or audio context not available');
      return;
    }
    
    try {
      // Resume audio context if suspended
      if (audioEngine.audioContext.state === 'suspended') {
        audioEngine.audioContext.resume().then(() => {
          console.log('Audio context resumed for test tone');
          generateTestTone();
        }).catch((error: any) => {
          console.error('Failed to resume audio context:', error);
        });
      } else {
        generateTestTone();
      }
    } catch (error) {
      console.error('Error playing test tone:', error);
    }
  }
  
  function generateTestTone() {
    try {
      // Create oscillator
      const oscillator = audioEngine.audioContext.createOscillator();
      const gainNode = audioEngine.audioContext.createGain();
      
      // Configure the oscillator
      oscillator.type = 'sine';
      oscillator.frequency.value = 440; // A4 note
      
      // Configure the gain (volume)
      gainNode.gain.value = 0.2; // 20% volume
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioEngine.audioContext.destination);
      
      // Start and stop the oscillator
      oscillator.start();
      oscillator.stop(audioEngine.audioContext.currentTime + 1); // 1 second duration
      
      console.log('Test tone started successfully');
    } catch (error) {
      console.error('Error generating test tone:', error);
    }
  }
  
  // Function to check MP3 decoder status
  async function checkMP3DecoderStatus(statusElement: HTMLElement) {
    try {
      statusElement.textContent = 'Checking...';
      statusElement.style.color = 'yellow';
      
      // Check for SharedArrayBuffer support first (required for most WASM-based decoders)
      if (typeof SharedArrayBuffer === 'undefined') {
        statusElement.textContent = 'SharedArrayBuffer not supported';
        statusElement.style.color = 'orange';
        return;
      }
      
      try {
        // Try to import the decoder
        const { MPEGDecoder } = await import('mpg123-decoder');
        
        if (typeof MPEGDecoder !== 'function') {
          statusElement.textContent = 'Import failed (not a constructor)';
          statusElement.style.color = 'red';
          return;
        }
        
        // Try to instantiate it
        statusElement.textContent = 'Initializing...';
        const decoder = new MPEGDecoder();
        
        // Wait for the decoder to be ready
        await decoder.ready;
        
        // Success!
        statusElement.textContent = 'Ready';
        statusElement.style.color = '#4CAF50';
        
        // Clean up
        decoder.free();
      } catch (error) {
        console.error('MP3 decoder initialization failed:', error);
        statusElement.textContent = 'Failed: ' + (error instanceof Error ? error.message : String(error));
        statusElement.style.color = 'red';
      }
    } catch (error) {
      console.error('Error checking MP3 decoder status:', error);
      statusElement.textContent = 'Error checking';
      statusElement.style.color = 'red';
    }
  }
}
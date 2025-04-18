// Audio debugging utilities

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
  
  // Set up debug panel toggle
  showDebugLogsCheckbox.addEventListener('change', () => {
    debugPanel.style.display = showDebugLogsCheckbox.checked ? 'block' : 'none';
  });
  
  // Set up test tone button
  testToneButton.addEventListener('click', () => {
    playTestTone();
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
}
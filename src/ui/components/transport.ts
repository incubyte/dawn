import { AudioEngine } from '../../core/audio-engine';
import { formatTime } from '../../utils/time-formatter';

export function createTransportControls(audioEngine?: AudioEngine): void {
  const transportContainer = document.getElementById('transport-controls');
  if (!transportContainer) return;

  transportContainer.innerHTML = `
    <div class="transport-buttons">
      <button id="play-button" class="transport-button" title="Play">
        <span class="icon">▶</span>
      </button>
      <button id="pause-button" class="transport-button" title="Pause">
        <span class="icon">⏸</span>
      </button>
      <button id="stop-button" class="transport-button" title="Stop">
        <span class="icon">■</span>
      </button>
    </div>
    <div class="time-display">
      <span id="current-time">00:00:000</span>
    </div>
    <button id="export-button" class="transport-button" title="Export">
      Export
    </button>
  `;

  // Set up event handlers
  setupTransportHandlers(audioEngine);
  
  // Start the timer update
  if (audioEngine) {
    startTimeUpdate(audioEngine);
  }
}

function setupTransportHandlers(audioEngine?: AudioEngine): void {
  const playButton = document.getElementById('play-button');
  const pauseButton = document.getElementById('pause-button');
  const stopButton = document.getElementById('stop-button');
  const exportButton = document.getElementById('export-button');
  
  if (playButton && audioEngine) {
    playButton.addEventListener('click', async () => {
      try {
        // First ensure the audio context is running
        if (audioEngine.audioContext.state === 'suspended') {
          console.log('Resuming audio context on play click...');
          await audioEngine.audioContext.resume();
        }
        
        console.log('Play button clicked, starting playback');
        
        // Start playback with explicit logging
        console.log('Calling audioEngine.startPlayback()...');
        audioEngine.startPlayback();
        console.log('Playback started successfully');
        
        // Update UI
        playButton.classList.add('active');
        if (pauseButton) pauseButton.classList.remove('active');
        if (stopButton) stopButton.classList.remove('active');
      } catch (error) {
        console.error('Error starting playback:', error);
      }
    });
  }
  
  if (pauseButton && audioEngine) {
    pauseButton.addEventListener('click', () => {
      console.log('Pause button clicked');
      
      audioEngine.pausePlayback();
      
      // Update UI
      pauseButton.classList.add('active');
      if (playButton) playButton.classList.remove('active');
    });
  }
  
  if (stopButton && audioEngine) {
    stopButton.addEventListener('click', () => {
      try {
        console.log('Stop button clicked');
        
        // Stop playback with explicit logging
        console.log('Calling audioEngine.stopPlayback()...');
        audioEngine.stopPlayback();
        console.log('Playback stopped successfully');
        
        // Update UI
        stopButton.classList.add('active');
        if (playButton) playButton.classList.remove('active');
        if (pauseButton) pauseButton.classList.remove('active');
        
        // Reset time display
        const timeDisplay = document.getElementById('current-time');
        if (timeDisplay) {
          timeDisplay.textContent = '00:00:000';
        }
        
        // Also update the timeline cursor position to the beginning
        const timelineCursor = document.querySelector('.timeline-cursor');
        if (timelineCursor) {
          (timelineCursor as HTMLElement).style.left = '0px';
        }
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
    });
  }
  
  if (exportButton && audioEngine) {
    exportButton.addEventListener('click', async () => {
      try {
        console.log('Export button clicked, starting export...');
        
        // Show exporting message
        exportButton.textContent = 'Exporting...';
        (exportButton as HTMLButtonElement).disabled = true;
        
        const blob = await audioEngine.exportMix();
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'daw-export.wav';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          // Reset button
          exportButton.textContent = 'Export';
          (exportButton as HTMLButtonElement).disabled = false;
        }, 100);
      } catch (error) {
        console.error('Error exporting mix:', error);
        exportButton.textContent = 'Export Failed';
        
        // Reset button after delay
        setTimeout(() => {
          exportButton.textContent = 'Export';
          (exportButton as HTMLButtonElement).disabled = false;
        }, 2000);
      }
    });
  }
}

function startTimeUpdate(audioEngine: AudioEngine): void {
  // Update time display every 16ms (roughly 60fps)
  const timeDisplay = document.getElementById('current-time');
  
  if (!timeDisplay) return;
  
  function updateTime() {
    if (timeDisplay) {
      const currentTime = audioEngine.currentTime;
      timeDisplay.textContent = formatTime(currentTime);
    }
    
    requestAnimationFrame(updateTime);
  }
  
  // Start the update loop
  updateTime();
}
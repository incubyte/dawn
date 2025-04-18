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
    <div class="transport-buttons">
      <button id="copy-button" class="transport-button" title="Copy Selected Clip (Ctrl+C)">
        <span class="icon">📋</span>
      </button>
      <button id="paste-button" class="transport-button" title="Paste to Selected Track (Ctrl+V)">
        <span class="icon">📄</span>
      </button>
      <button id="trim-info-button" class="transport-button" title="Tip: Select a clip and drag the side handles to trim">
        <span class="icon">✂️ Trim</span>
      </button>
      <button id="delete-clip-button" class="transport-button" title="Delete Selected Clip">
        <span class="icon">🗑️</span>
      </button>
      <button id="delete-track-button" class="transport-button" title="Delete Selected Track">
        <span class="icon">🗑️ Track</span>
      </button>
      <button id="export-button" class="transport-button" title="Export">
        Export
      </button>
    </div>
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
  const copyButton = document.getElementById('copy-button');
  const pasteButton = document.getElementById('paste-button');
  const trimInfoButton = document.getElementById('trim-info-button');
  const deleteClipButton = document.getElementById('delete-clip-button');
  const deleteTrackButton = document.getElementById('delete-track-button');
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
  
  // Delete clip button
  if (deleteClipButton) {
    deleteClipButton.addEventListener('click', () => {
      console.log('Delete clip button clicked');
      
      // Find the currently selected clip
      const selectedClip = document.querySelector('.audio-clip.selected');
      if (selectedClip) {
        const clipId = selectedClip.getAttribute('data-clip-id');
        const trackElement = selectedClip.closest('.track');
        
        if (clipId && trackElement) {
          const trackId = trackElement.getAttribute('data-track-id');
          if (trackId) {
            // Dispatch a custom event for deleting the clip
            const deleteEvent = new CustomEvent('clip:delete', {
              bubbles: true,
              detail: {
                clipId,
                trackElement,
                clipElement: selectedClip
              }
            });
            
            selectedClip.dispatchEvent(deleteEvent);
          }
        }
      } else {
        console.log('No clip selected to delete');
      }
    });
  }
  
  // Copy button
  if (copyButton) {
    copyButton.addEventListener('click', () => {
      console.log('Copy button clicked');
      
      // Dispatch a custom event for copying the selected clip
      const copyEvent = new CustomEvent('clip:copy', {
        bubbles: true
      });
      
      document.dispatchEvent(copyEvent);
    });
  }
  
  // Paste button
  if (pasteButton) {
    pasteButton.addEventListener('click', () => {
      console.log('Paste button clicked');
      
      // Dispatch a custom event for pasting to the selected track
      const pasteEvent = new CustomEvent('clip:paste', {
        bubbles: true
      });
      
      document.dispatchEvent(pasteEvent);
    });
  }
  
  // Trim info button - shows a tooltip explaining how to trim
  if (trimInfoButton) {
    trimInfoButton.addEventListener('click', () => {
      console.log('Trim info button clicked');
      
      // Create toast notification with trim instructions
      const notification = document.createElement('div');
      notification.className = 'toast-notification';
      notification.style.width = '250px';
      notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">How to trim audio clips:</div>
        <ol style="margin: 0; padding-left: 20px; text-align: left;">
          <li>Select a clip</li>
          <li>Drag the left handle to trim the start</li>
          <li>Drag the right handle to trim the end</li>
        </ol>
      `;
      document.body.appendChild(notification);
      
      // Show and then hide the notification
      setTimeout(() => {
        notification.classList.add('visible');
        setTimeout(() => {
          notification.classList.remove('visible');
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 300); // Wait for fade-out animation
        }, 4000); // Show for 4 seconds (longer for this info toast)
      }, 10);
    });
  }
  
  // Delete track button
  if (deleteTrackButton) {
    deleteTrackButton.addEventListener('click', () => {
      console.log('Delete track button clicked');
      
      // Find the currently selected track
      const selectedTrack = document.querySelector('.track.selected');
      if (selectedTrack) {
        const trackId = selectedTrack.getAttribute('data-track-id');
        if (trackId) {
          // Dispatch a custom event for deleting the track
          const deleteEvent = new CustomEvent('track:delete', {
            bubbles: true,
            detail: {
              trackId,
              trackElement: selectedTrack
            }
          });
          
          selectedTrack.dispatchEvent(deleteEvent);
        }
      } else {
        console.log('No track selected to delete');
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
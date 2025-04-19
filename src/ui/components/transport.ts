import { AudioEngine } from '../../core/audio-engine';
import { formatTime } from '../../utils/time-formatter';

export function createTransportControls(audioEngine?: AudioEngine): void {
  const transportContainer = document.getElementById('transport-controls');
  if (!transportContainer) return;

  transportContainer.innerHTML = `
    <div class="transport-buttons">
      <button id="play-toggle-button" class="transport-button" title="Play/Pause (Space)">
        <span class="icon">▶</span>
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
      <button id="save-button" class="transport-button" title="Save Project">
        Save
      </button>
      <button id="save-as-button" class="transport-button" title="Save Project As...">
        Save As
      </button>
      <button id="load-button" class="transport-button" title="Load Project">
        Load
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
  
  // Set up global keyboard shortcuts
  setupKeyboardShortcuts(audioEngine);
}

function setupTransportHandlers(audioEngine?: AudioEngine): void {
  const playToggleButton = document.getElementById('play-toggle-button');
  const stopButton = document.getElementById('stop-button');
  const copyButton = document.getElementById('copy-button');
  const pasteButton = document.getElementById('paste-button');
  const trimInfoButton = document.getElementById('trim-info-button');
  const deleteClipButton = document.getElementById('delete-clip-button');
  const deleteTrackButton = document.getElementById('delete-track-button');
  const saveButton = document.getElementById('save-button');
  const saveAsButton = document.getElementById('save-as-button');
  const loadButton = document.getElementById('load-button');
  const exportButton = document.getElementById('export-button');
  
  // Function to toggle play/pause state
  const togglePlayPause = async () => {
    try {
      if (!audioEngine) return;
      
      // Check if currently playing
      if (audioEngine.isPlaying) {
        // Pause playback
        console.log('Pausing playback');
        audioEngine.pausePlayback();
        
        // Update button icon to show play
        if (playToggleButton) {
          playToggleButton.querySelector('.icon')!.textContent = '▶';
          playToggleButton.classList.remove('active');
        }
        
        console.log('Playback paused successfully');
      } else {
        // First ensure the audio context is running
        if (audioEngine.audioContext.state === 'suspended') {
          console.log('Resuming audio context on play click...');
          await audioEngine.audioContext.resume();
        }
        
        console.log('Starting playback');
        
        // Start playback with explicit logging
        console.log('Calling audioEngine.startPlayback()...');
        audioEngine.startPlayback();
        
        // Update button icon to show pause
        if (playToggleButton) {
          playToggleButton.querySelector('.icon')!.textContent = '⏸';
          playToggleButton.classList.add('active');
        }
        
        // Remove active class from stop button
        if (stopButton) stopButton.classList.remove('active');
        
        console.log('Playback started successfully');
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };
  
  // Play/Pause toggle button
  if (playToggleButton && audioEngine) {
    playToggleButton.addEventListener('click', togglePlayPause);
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
        
        // Reset play button to show play icon
        const playToggleButton = document.getElementById('play-toggle-button');
        if (playToggleButton) {
          playToggleButton.classList.remove('active');
          playToggleButton.querySelector('.icon')!.textContent = '▶';
        }
        
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
        
        // Reset the playback cursor position to the beginning as well
        const playbackCursor = document.querySelector('.playback-cursor');
        if (playbackCursor) {
          // Account for the track header width (200px)
          (playbackCursor as HTMLElement).style.left = '200px';
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
  
  // Helper function to show notifications
  function showNotification(message: string, isError: boolean = false) {
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    if (isError) {
      notification.style.backgroundColor = 'rgba(231, 76, 60, 0.9)';
    }
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Show and then hide the notification
    setTimeout(() => {
      notification.classList.add('visible');
      setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300); // Wait for fade-out animation
      }, 1500); // Show for 1.5 seconds
    }, 10);
  }
  
  // Helper function to initiate a download
  async function downloadProject(blob: Blob, fileName: string) {
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
  
  // Save project button - uses existing filename when available
  if (saveButton && audioEngine) {
    saveButton.addEventListener('click', async () => {
      console.log('Save button clicked');
      
      try {
        // Check if we have a current project file
        const originalFileName = audioEngine.projectService.getOriginalFileName();
        const currentProjectName = audioEngine.projectService.getCurrentProjectName();
        
        if (!currentProjectName) {
          // If no project name exists yet, redirect to Save As functionality
          if (saveAsButton) {
            console.log('No current project name, redirecting to Save As');
            saveAsButton.click();
            return;
          }
        }
        
        // Show saving message
        saveButton.textContent = 'Saving...';
        (saveButton as HTMLButtonElement).disabled = true;
        
        if (originalFileName) {
          // Local storage with existing file - show browser limitation explanation
          const confirmDialog = document.createElement('div');
          confirmDialog.className = 'confirmation-dialog';
          confirmDialog.innerHTML = `
            <div class="confirmation-content">
              <h2>Save Project</h2>
              <p>Your project "${currentProjectName}" will be saved as an updated version.</p>
              <p><strong>Important:</strong> Due to browser security, this will download a new file "${originalFileName}" 
              that will replace your previous version.</p>
              <p>To update your project, simply save this file in the same location as the original.</p>
              <div class="confirmation-buttons">
                <button id="confirm-save">Save</button>
                <button id="cancel-save">Cancel</button>
              </div>
            </div>
          `;
          document.body.appendChild(confirmDialog);
          
          // Add event handlers for the dialog buttons
          return new Promise<void>((resolve) => {
            const confirmButton = document.getElementById('confirm-save');
            const cancelButton = document.getElementById('cancel-save');
            
            if (confirmButton) {
              confirmButton.addEventListener('click', async () => {
                // Remove the dialog
                document.body.removeChild(confirmDialog);
                
                // Proceed with the save operation
                const projectBlob = await audioEngine.saveProject(currentProjectName!);
                const fileName = originalFileName;
                console.log(`Saving project to file: ${fileName}`);
                
                // Download the project
                await downloadProject(projectBlob, fileName);
                
                // Show success notification with special message for updates
                showNotification(`Project saved. Replace the original file with this updated version.`);
                
                resolve();
              });
            }
            
            if (cancelButton) {
              cancelButton.addEventListener('click', () => {
                // Remove the dialog and cancel the operation
                document.body.removeChild(confirmDialog);
                resolve();
              });
            }
          }).finally(() => {
            // Reset button regardless of selection
            saveButton.textContent = 'Save';
            (saveButton as HTMLButtonElement).disabled = false;
          });
        } else {
          // For new projects, save locally
          try {
            const projectBlob = await audioEngine.saveProject(currentProjectName!);
            const fileName = `${currentProjectName}.dawn.zip`;
            console.log(`Saving project to file: ${fileName}`);
            
            // Download the project
            await downloadProject(projectBlob, fileName);
            
            // Show success notification
            showNotification('Project saved successfully');
          } finally {
            // Reset button regardless of success/failure
            saveButton.textContent = 'Save';
            (saveButton as HTMLButtonElement).disabled = false;
          }
        }
      } catch (error: unknown) {
        console.error('Error saving project:', error);
        showNotification('Failed to save project', true);
        
        // Make sure the button is reset if there's an error
        if (saveButton) {
          saveButton.textContent = 'Save';
          (saveButton as HTMLButtonElement).disabled = false;
        }
      }
    });
  }
  
  // Save As project button - always asks for a filename
  if (saveAsButton && audioEngine) {
    saveAsButton.addEventListener('click', async () => {
      console.log('Save As button clicked');
      
      try {
        // Get current project name as default
        const currentProjectName = audioEngine.projectService.getCurrentProjectName() || 'My Project';
        
        // Show a dialog to let the user enter a project name
        const projectName = prompt('Enter a name for your project:', currentProjectName);
        if (!projectName) {
          console.log('Save cancelled - no project name provided');
          return;
        }
        
        // Show saving message
        saveAsButton.textContent = 'Saving...';
        (saveAsButton as HTMLButtonElement).disabled = true;
        
        try {
          // Use the project service to save the project
          const projectBlob = await audioEngine.saveProject(projectName);
          
          // Always generate a new filename for Save As
          const fileName = `${projectName}.dawn.zip`;
          console.log(`Saving project as: ${fileName}`);
          
          // Download the project locally
          await downloadProject(projectBlob, fileName);
            
          // Show success notification
          showNotification('Project saved as "' + projectName + '"');
        } finally {
          // Reset button regardless of success/failure
          saveAsButton.textContent = 'Save As';
          (saveAsButton as HTMLButtonElement).disabled = false;
        }
      } catch (error) {
        console.error('Error saving project:', error);
        showNotification('Failed to save project', true);
      }
    });
  }
  
  // Load project button
  if (loadButton && audioEngine) {
    // Store references to elements and services we'll need
    const localAudioEngine = audioEngine;
    const localLoadButton = loadButton;
    
    localLoadButton.addEventListener('click', () => {
      console.log('Load button clicked');
      handleLocalFileLoad();
    });
    
    // Helper function to handle local file loading
    async function handleLocalFileLoad() {
      try {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.dawn.zip,.zip';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // Handle file selection
        fileInput.addEventListener('change', async () => {
          if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            console.log(`Selected file: ${file.name}`);
            
            // Show loading message
            localLoadButton.textContent = 'Loading...';
            (localLoadButton as HTMLButtonElement).disabled = true;
            
            try {
              // Load the project
              console.log('Starting project load...');
              const success = await localAudioEngine.loadProject(file);
              console.log(`Project load result: ${success ? 'success' : 'failure'}`);
              
              // Local file loaded
              
              // Force update track width and UI after loading
              setTimeout(() => {
                console.log('Triggering UI update after project load');
                document.dispatchEvent(new CustomEvent('updateTrackWidth'));
              }, 500);
              
              if (success) {
                showNotification('Project loaded successfully');
              } else {
                showNotification('Failed to load project', true);
              }
            } catch (error: unknown) {
              console.error('Error loading project:', error);
              showNotification('Error loading project', true);
            } finally {
              // Reset button
              localLoadButton.textContent = 'Load';
              (localLoadButton as HTMLButtonElement).disabled = false;
            }
          }
          
          // Clean up
          document.body.removeChild(fileInput);
        });
        
        // Trigger the file dialog
        fileInput.click();
      } catch (error: unknown) {
        console.error('Error setting up file input:', error);
        
        // Reset button
        localLoadButton.textContent = 'Load';
        (localLoadButton as HTMLButtonElement).disabled = false;
      }
    }
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
      } catch (error: unknown) {
        console.error('Error exporting mix:', error);
        
        if (exportButton) {
          exportButton.textContent = 'Export Failed';
          
          // Reset button after delay
          setTimeout(() => {
            if (exportButton) {
              exportButton.textContent = 'Export';
              (exportButton as HTMLButtonElement).disabled = false;
            }
          }, 2000);
        }
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

// Handle global keyboard shortcuts
function setupKeyboardShortcuts(audioEngine?: AudioEngine): void {
  if (!audioEngine) return;
  
  // Add event listener to document for spacebar press
  document.addEventListener('keydown', (event) => {
    // Skip if user is typing in an input or textarea
    if (
      event.target instanceof HTMLInputElement || 
      event.target instanceof HTMLTextAreaElement ||
      (event.target as HTMLElement).contentEditable === 'true'
    ) {
      return;
    }
    
    // Spacebar toggles play/pause
    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault(); // Prevent scrolling the page
      
      console.log(`Spacebar pressed, isPlaying: ${audioEngine.isPlaying}`);
      
      // Trigger the play/pause toggle button click event
      const playToggleButton = document.getElementById('play-toggle-button');
      if (playToggleButton) {
        playToggleButton.click();
      }
    }
  });
  
  console.log('Keyboard shortcuts set up successfully');
}
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
  const saveButton = document.getElementById('save-button');
  const saveAsButton = document.getElementById('save-as-button');
  const loadButton = document.getElementById('load-button');
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
        
        try {
          // For a loaded project, show a more informative confirmation dialog
          if (originalFileName) {
            // For better UX, let's show a modal explaining the browser limitation
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
            // For new projects, just save with the current name
            const projectBlob = await audioEngine.saveProject(currentProjectName!);
            const fileName = `${currentProjectName}.dawn.zip`;
            console.log(`Saving project to file: ${fileName}`);
            
            // Download the project
            await downloadProject(projectBlob, fileName);
            
            // Show success notification
            showNotification('Project saved successfully');
          }
        } finally {
          // Reset button regardless of success/failure
          saveButton.textContent = 'Save';
          (saveButton as HTMLButtonElement).disabled = false;
        }
      } catch (error) {
        console.error('Error saving project:', error);
        showNotification('Failed to save project', true);
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
          
          // Download the project
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
    loadButton.addEventListener('click', async () => {
      console.log('Load button clicked');
      
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
            loadButton.textContent = 'Loading...';
            (loadButton as HTMLButtonElement).disabled = true;
            
            try {
              // Load the project
              console.log('Starting project load...');
              const success = await audioEngine.loadProject(file);
              console.log(`Project load result: ${success ? 'success' : 'failure'}`);
              
              // Force update track width and UI after loading
              setTimeout(() => {
                console.log('Triggering UI update after project load');
                document.dispatchEvent(new CustomEvent('updateTrackWidth'));
              }, 500);
              
              if (success) {
                console.log('Project loaded successfully');
                
                // Show success notification
                const notification = document.createElement('div');
                notification.className = 'toast-notification';
                notification.textContent = 'Project loaded successfully';
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
              } else {
                console.error('Failed to load project');
                
                // Show error notification
                const notification = document.createElement('div');
                notification.className = 'toast-notification';
                notification.style.backgroundColor = 'rgba(231, 76, 60, 0.9)';
                notification.textContent = 'Failed to load project';
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
            } catch (error) {
              console.error('Error loading project:', error);
              
              // Show error notification
              const notification = document.createElement('div');
              notification.className = 'toast-notification';
              notification.style.backgroundColor = 'rgba(231, 76, 60, 0.9)';
              notification.textContent = 'Error loading project';
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
            } finally {
              // Reset button
              loadButton.textContent = 'Load';
              (loadButton as HTMLButtonElement).disabled = false;
            }
          }
          
          // Clean up
          document.body.removeChild(fileInput);
        });
        
        // Trigger the file dialog
        fileInput.click();
      } catch (error) {
        console.error('Error setting up file input:', error);
        
        // Reset button
        loadButton.textContent = 'Load';
        (loadButton as HTMLButtonElement).disabled = false;
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
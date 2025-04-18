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
          // Import the settings/providers context
          const { appSettings } = await import('../components/welcome-screen');
          
          // Check the storage provider first
          if (appSettings.storageProvider === 'github' && appSettings.githubToken && appSettings.githubRepo) {
            // Save to GitHub - this handles all GitHub projects regardless of whether they were loaded from GitHub
            try {
              const projectBlob = await audioEngine.saveProject(currentProjectName!);
              
              // Import the GitHub service dynamically
              try {
                const { GitHubService } = await import('../../services/github-service');
                const githubService = new GitHubService();
                
                // Check if we have a GitHub path from a previously loaded GitHub project
                const githubPath = audioEngine.projectService.getGitHubPath();
                
                // Use the GitHub path if available, otherwise use the original filename or create a new one
                const savePath = githubPath || originalFileName || `${currentProjectName}.dawn.zip`;
                
                console.log(`Saving to GitHub using path: ${savePath}`);
                
                // Save to GitHub
                await githubService.saveProject(savePath, projectBlob);
                
                // Show success notification with the path
                const repoInfo = appSettings.githubRepo;
                const fileName = savePath.split('/').pop();
                showNotification(`Project "${fileName}" saved to GitHub repository: ${repoInfo}`);
              } catch (githubError) {
                console.error('Error using GitHub service:', githubError);
                
                // Fallback to local download with warning
                const githubPath = audioEngine.projectService.getGitHubPath();
                const fallbackName = githubPath?.split('/').pop() || originalFileName || `${currentProjectName}.dawn.zip`;
                await downloadProject(projectBlob, fallbackName);
                showNotification('Failed to save to GitHub - downloaded locally instead', true);
              }
            } catch (error) {
              console.error('Error saving project:', error);
              showNotification('Failed to save project', true);
            }
          } else if (originalFileName) {
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
            // For new projects, we need to check if we're using GitHub
            if (appSettings.storageProvider === 'github' && appSettings.githubToken && appSettings.githubRepo) {
              // New project to be saved to GitHub
              try {
                const projectBlob = await audioEngine.saveProject(currentProjectName!);
                const fileName = `${currentProjectName}.dawn.zip`;
                console.log(`Saving new project to GitHub: ${fileName}`);
                
                // Import the GitHub service dynamically
                const { GitHubService } = await import('../../services/github-service');
                const githubService = new GitHubService();
                
                // Save to GitHub
                await githubService.saveProject(fileName, projectBlob);
                
                // Show success notification
                showNotification('New project saved to GitHub successfully');
              } catch (error) {
                console.error('Error saving new project to GitHub:', error);
                
                // Fallback to local download
                const projectBlob = await audioEngine.saveProject(currentProjectName!);
                const fileName = `${currentProjectName}.dawn.zip`;
                await downloadProject(projectBlob, fileName);
                
                showNotification('Failed to save to GitHub - downloaded locally instead', true);
              }
            } else {
              // Regular local storage for new projects
              const projectBlob = await audioEngine.saveProject(currentProjectName!);
              const fileName = `${currentProjectName}.dawn.zip`;
              console.log(`Saving project to file: ${fileName}`);
              
              // Download the project
              await downloadProject(projectBlob, fileName);
              
              // Show success notification
              showNotification('Project saved successfully');
            }
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
          // Import the settings to check storage provider
          const { appSettings } = await import('../components/welcome-screen');
          
          // Use the project service to save the project
          const projectBlob = await audioEngine.saveProject(projectName);
          
          // Always generate a new filename for Save As
          const fileName = `${projectName}.dawn.zip`;
          console.log(`Saving project as: ${fileName}`);
          
          // Check which storage provider to use
          if (appSettings.storageProvider === 'github' && appSettings.githubToken && appSettings.githubRepo) {
            // Save to GitHub
            try {
              // Import the GitHub service dynamically
              const { GitHubService } = await import('../../services/github-service');
              const githubService = new GitHubService();
              
              // Check for GitHub path from previously loaded project
              const githubPath = audioEngine.projectService.getGitHubPath();
              
              // For SaveAs, we'll create a new path based on the new name, preserving directory structure if present
              let newPath = fileName;
              if (githubPath) {
                // If there's a directory structure in the original path, maintain it
                const lastSlash = githubPath.lastIndexOf('/');
                if (lastSlash > 0) {
                  // Keep the directory structure but use the new filename
                  newPath = githubPath.substring(0, lastSlash + 1) + fileName;
                }
              }
              
              console.log(`Saving to GitHub using path: ${newPath}`);
              
              // Save with new path and update the stored path
              await githubService.saveProject(newPath, projectBlob);
              audioEngine.projectService.setGitHubPath(newPath);
              
              // Show success notification
              const repoInfo = appSettings.githubRepo;
              showNotification(`Project "${fileName}" saved to GitHub repository: ${repoInfo}`);
            } catch (githubError) {
              console.error('Error using GitHub service:', githubError);
              
              // Fallback to local download with warning
              await downloadProject(projectBlob, fileName);
              showNotification('Failed to save to GitHub - downloaded locally instead', true);
            }
          } else {
            // Download the project locally
            await downloadProject(projectBlob, fileName);
            
            // Show success notification
            showNotification('Project saved as "' + projectName + '"');
          }
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
        // Import the settings to check storage provider
        const { appSettings } = await import('../components/welcome-screen');
        
        // Check which storage provider to use
        if (appSettings.storageProvider === 'github' && appSettings.githubToken && appSettings.githubRepo) {
          // Use GitHub as storage provider
          try {
            // Show loading message
            loadButton.textContent = 'Loading...';
            (loadButton as HTMLButtonElement).disabled = true;
            
            // Import the GitHub service
            const { GitHubService } = await import('../../services/github-service');
            const githubService = new GitHubService();
            
            try {
              // Create a GitHub project selector dialog
              const dialog = document.createElement('div');
              dialog.className = 'modal-dialog visible';
              dialog.innerHTML = `
                <div class="modal-content">
                  <div class="modal-header">
                    <h2>Select Project from GitHub</h2>
                    <button class="close-button" id="gh-close-dialog">&times;</button>
                  </div>
                  <div class="modal-body">
                    <div id="gh-projects-list" class="github-container">
                      <p>Loading projects from GitHub...</p>
                    </div>
                  </div>
                </div>
              `;
              
              document.body.appendChild(dialog);
              
              // Handle close button
              const closeButton = document.getElementById('gh-close-dialog');
              if (closeButton) {
                closeButton.addEventListener('click', () => {
                  document.body.removeChild(dialog);
                  loadButton.textContent = 'Load';
                  (loadButton as HTMLButtonElement).disabled = false;
                });
              }
              
              // Load projects from GitHub
              const projectsList = document.getElementById('gh-projects-list');
              if (projectsList) {
                try {
                  const projects = await githubService.listProjects();
                  
                  if (projects.length === 0) {
                    projectsList.innerHTML = '<p>No projects found in this repository.</p>';
                  } else {
                    projectsList.innerHTML = `
                      <h3>Select a project to load:</h3>
                      <div class="github-repo-selector">
                        ${projects.map(project => `
                          <div class="repo-item" data-path="${project.path}">
                            <span class="repo-icon">📄</span>
                            <span class="repo-name">${project.name}</span>
                          </div>
                        `).join('')}
                      </div>
                    `;
                    
                    // Add click handlers for project items
                    const projectItems = document.querySelectorAll('.repo-item');
                    projectItems.forEach(item => {
                      item.addEventListener('click', async () => {
                        const path = item.getAttribute('data-path');
                        
                        if (path) {
                          try {
                            // Show loading state
                            projectsList.innerHTML = '<p>Loading project...</p>';
                            
                            // Get the project blob from GitHub
                            const projectBlob = await githubService.getProject(path);
                            
                            // Remove the dialog
                            document.body.removeChild(dialog);
                            
                            // Convert to File object
                            const file = new File([projectBlob], path.split('/').pop() || 'project.dawn.zip', {
                              type: 'application/zip'
                            });
                            
                            // Load the project
                            const success = await audioEngine.loadProject(file);
                            
                            // Store the GitHub path for later use (needed when saving back to GitHub)
                            audioEngine.projectService.setGitHubPath(path);
                            
                            console.log(`GitHub project loaded from path: ${path}`);
                            
                            // Force update track width and UI after loading
                            setTimeout(() => {
                              document.dispatchEvent(new CustomEvent('updateTrackWidth'));
                            }, 500);
                            
                            if (success) {
                              showNotification('Project loaded successfully from GitHub');
                            } else {
                              showNotification('Failed to load project', true);
                            }
                          } catch (error) {
                            console.error('Error loading GitHub project:', error);
                            showNotification('Error loading project from GitHub', true);
                          } finally {
                            loadButton.textContent = 'Load';
                            (loadButton as HTMLButtonElement).disabled = false;
                          }
                        }
                      });
                    });
                  }
                } catch (error) {
                  console.error('Error listing GitHub projects:', error);
                  projectsList.innerHTML = `
                    <p class="error">Error loading projects from GitHub: ${error.message}</p>
                    <p>Please check your GitHub token and repository settings.</p>
                  `;
                }
              }
            } catch (error) {
              console.error('Error with GitHub UI:', error);
              showNotification('Error connecting to GitHub', true);
              loadButton.textContent = 'Load';
              (loadButton as HTMLButtonElement).disabled = false;
            }
          } catch (error) {
            console.error('Error importing GitHub service:', error);
            showNotification('GitHub integration failed - falling back to local load', true);
            
            // Fall back to local file loading
            handleLocalFileLoad();
          }
        } else {
          // Use local storage
          handleLocalFileLoad();
        }
      } catch (error) {
        console.error('Error during load operation:', error);
        showNotification('Error loading project', true);
        loadButton.textContent = 'Load';
        (loadButton as HTMLButtonElement).disabled = false;
      }
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
            loadButton.textContent = 'Loading...';
            (loadButton as HTMLButtonElement).disabled = true;
            
            try {
              // Load the project
              console.log('Starting project load...');
              const success = await audioEngine.loadProject(file);
              console.log(`Project load result: ${success ? 'success' : 'failure'}`);
              
              // Clear any GitHub path since this is a local file
              audioEngine.projectService.setGitHubPath(null);
              
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
            } catch (error) {
              console.error('Error loading project:', error);
              showNotification('Error loading project', true);
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
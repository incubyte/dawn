import { createClipElement } from './components/clip';
import { AudioClip } from '../models/audio-clip';
import { AudioTrack } from '../models/audio-track';
import { formatTime } from '../utils/time-formatter';
import { createAudioFileService } from '../services/audio-file-service';
import { createTrackService } from '../services/track-service';
import { showLoadingIndicator, hideLoadingIndicator, showErrorNotification } from './components/loading';
import { AudioEngine } from '../core/audio-engine';
import { updateTrackWidth, centerViewOnTime } from '../utils/scroll-sync';

// Global variable to track the currently selected track
let selectedTrackId: string | null = null;

// Function to get the currently selected track ID
export function getSelectedTrackId(): string | null {
  return selectedTrackId;
}

// Function to set the selected track programmatically
export function setSelectedTrack(trackId: string | null): void {
  if (trackId === selectedTrackId) return;
  
  // Deselect all tracks first
  document.querySelectorAll('.track').forEach(el => {
    el.classList.remove('selected');
  });
  
  // Update the selected track ID
  selectedTrackId = trackId;
  
  // If a track ID was provided, find and select that track element
  if (trackId) {
    const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
    if (trackElement) {
      trackElement.classList.add('selected');
    }
  }
}

export function setupEventHandlers(
  audioContext: AudioContext,
  masterGainNode: GainNode,
  audioEngine?: AudioEngine
): void {
  // Use the trackService from the audio engine if provided, otherwise create a new one
  // (but this will cause tracks added here to not be played by the audio engine)
  const trackService = audioEngine ? audioEngine.trackService : createTrackService(audioContext, masterGainNode);
  const audioFileService = createAudioFileService(audioContext);
  
  // State management
  let isPlaying = false;
  let currentPlaybackTime = 0;
  let startTime = 0;
  let pixelsPerSecond = 10; // 10px = 1 second
  
  // Elements
  const playButton = document.getElementById('play-button');
  const stopButton = document.getElementById('stop-button');
  const addTrackButton = document.getElementById('add-track-button');
  const currentTimeDisplay = document.getElementById('current-time');
  const exportButton = document.getElementById('export-button');
  const tracksContainer = document.getElementById('tracks-container');
  const timelineCursor = document.querySelector('.timeline-cursor');
  
  // Set up keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Listen for track deletion events
  document.addEventListener('track:delete', (e: Event) => {
    const customEvent = e as CustomEvent;
    const { trackId } = customEvent.detail;
    
    if (trackId) {
      removeTrack(trackId);
    }
  });
  
  // Listen for clip copy events
  document.addEventListener('clip:copy', () => {
    copySelectedClip();
  });
  
  // Listen for clip paste events
  document.addEventListener('clip:paste', () => {
    pasteClipToSelectedTrack();
  });
  
  // Listen for clip trim events
  document.addEventListener('clip:trim', (e: Event) => {
    const customEvent = e as CustomEvent;
    const { trackId, clipId, startTime, duration, offset } = customEvent.detail;
    
    console.log(`Trim event: Track ${trackId}, Clip ${clipId}`);
    console.log(`New values: startTime=${startTime}, duration=${duration}, offset=${offset}`);
    
    // Update the clip in the track service
    const track = trackService.getAllTracks().find(t => t.id === trackId);
    if (track) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        // Update the clip properties
        clip.startTime = startTime;
        clip.duration = duration;
        clip.offset = offset;
        
        console.log(`Updated clip ${clipId} in track ${trackId}: startTime=${startTime}, duration=${duration}, offset=${offset}`);
        
        // Create toast notification
        const notification = document.createElement('div');
        notification.className = 'toast-notification';
        notification.textContent = 'Clip trimmed';
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
    }
  });
  
  // Transport controls - only apply these if we don't have a reference to the AudioEngine
  // (otherwise, they're handled by transport.ts)
  if (!audioEngine) {
    if (playButton) {
      playButton.addEventListener('click', () => {
        if (!isPlaying) {
          isPlaying = true;
          startTime = audioContext.currentTime - currentPlaybackTime;
          updateTimer();
        }
      });
    }
    
    if (stopButton) {
      stopButton.addEventListener('click', () => {
        if (isPlaying) {
          isPlaying = false;
        }
        currentPlaybackTime = 0;
        updateTimeDisplay();
        updateCursorPosition();
      });
    }
  }
  
  // Add track button
  if (addTrackButton) {
    addTrackButton.addEventListener('click', () => {
      // Deselect all existing tracks
      document.querySelectorAll('.track').forEach(el => {
        el.classList.remove('selected');
      });
      
      // Add new track and select it
      const track = trackService.addTrack();
      selectedTrackId = track.id; // Set as selected track
      addTrackToUI(track);
    });
  }
  
  // Export button
  if (exportButton) {
    exportButton.addEventListener('click', async () => {
      // Export functionality would be added here
      console.log('Export clicked');
    });
  }
  
  // Handle import event from the dialog
  document.addEventListener('audio:import', (e: Event) => {
    const customEvent = e as CustomEvent;
    const { trackId, files } = customEvent.detail;
    
    if (files && files.length > 0 && trackId) {
      handleImportedFiles(files, trackId);
    }
  });
  
  // Function to handle imported files
  async function handleImportedFiles(files: File[], trackId: string) {
    // Show loading indicator message
    showLoadingIndicator("Importing audio files...");
    
    try {
      // Process each file in sequence
      for (const file of files) {
        try {
          const audioBuffer = await audioFileService.loadAudioFile(file);
          
          // Add clip to end of current content
          const clips = trackService.getTrackClips(trackId);
          let startTime = 0;
          
          if (clips && clips.length > 0) {
            // Calculate the end time of the last clip
            const lastClip = clips.reduce((latest, clip) => {
              const clipEndTime = clip.startTime + clip.duration;
              return clipEndTime > latest.endTime 
                ? { endTime: clipEndTime } 
                : latest;
            }, { endTime: 0 });
            
            startTime = lastClip.endTime + 0.5; // Add a small gap
          }
          
          const clip: AudioClip = {
            id: crypto.randomUUID(),
            buffer: audioBuffer,
            startTime,
            duration: audioBuffer.duration,
            offset: 0,
            name: file.name
          };
          
          addClipToTrack(trackId, clip);
          
          // Update track width to accommodate the new clip
          updateTrackWidth();
          
          // Center view on the new clip
          centerViewOnTime(clip.startTime + (clip.duration / 2), pixelsPerSecond);
        } catch (error) {
          console.error(`Error loading audio file ${file.name}:`, error);
          showErrorNotification(`Failed to load "${file.name}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } finally {
      hideLoadingIndicator();
    }
  }
  
  // Update timer function
  function updateTimer() {
    if (!isPlaying) return;
    
    currentPlaybackTime = audioContext.currentTime - startTime;
    updateTimeDisplay();
    updateCursorPosition();
    
    requestAnimationFrame(updateTimer);
  }
  
  function updateTimeDisplay() {
    if (currentTimeDisplay) {
      currentTimeDisplay.textContent = formatTime(currentPlaybackTime);
    }
  }
  
  function updateCursorPosition() {
    if (timelineCursor) {
      const position = currentPlaybackTime * pixelsPerSecond;
      (timelineCursor as HTMLElement).style.left = `${position}px`;
    }
  }
  
  // Add a track to the UI
  function addTrackToUI(track: AudioTrack) {
    if (!tracksContainer) return;
    
    const trackElement = document.createElement('div');
    trackElement.classList.add('track');
    trackElement.dataset.trackId = track.id;
    
    // If no track is selected yet, select this one as default
    if (selectedTrackId === null) {
      selectedTrackId = track.id;
      trackElement.classList.add('selected');
    }
    
    // Create a track name using "Track X" format
    const trackCount = document.querySelectorAll('.track').length + 1;
    const trackName = `Track ${trackCount}`;
    
    trackElement.innerHTML = `
      <div class="track-header">
        <div class="track-controls">
          <button class="mute-button" title="Mute">M</button>
          <button class="solo-button" title="Solo">S</button>
          <div class="track-name" title="${trackName}">${trackName}</div>
          <button class="delete-track-btn" title="Delete Track">✕</button>
        </div>
        <div class="track-fader">
          <span class="volume-label">Volume</span>
          <input type="range" min="0" max="1" step="0.01" value="1" class="gain-slider" title="Volume">
          <span class="volume-display">100%</span>
        </div>
      </div>
      <div class="track-clips"></div>
    `;
    
    // Add click event to select this track
    trackElement.addEventListener('click', (e) => {
      // Don't trigger track selection if clicking on a button or slider
      const target = e.target as HTMLElement;
      if (
        target.classList.contains('mute-button') || 
        target.classList.contains('solo-button') || 
        target.classList.contains('delete-track-btn') ||
        target.tagName === 'INPUT'
      ) {
        return;
      }
      
      // Deselect all tracks
      document.querySelectorAll('.track').forEach(el => {
        el.classList.remove('selected');
      });
      
      // Select this track
      trackElement.classList.add('selected');
      selectedTrackId = track.id;
      
      console.log(`Selected track: ${track.id}`);
    });
    
    tracksContainer.appendChild(trackElement);
    
    // Add event listeners for track controls
    // Set up mute button with track service integration
    const muteButton = trackElement.querySelector('.mute-button');
    if (muteButton) {
      muteButton.addEventListener('click', () => {
        // Use track service to handle muting (which also updates audio graph)
        const isMuted = trackService.toggleMute(track.id);
        // Update UI to reflect the mute state
        muteButton.classList.toggle('active', isMuted);
        // Add visual feedback
        muteButton.setAttribute('title', isMuted ? 'Unmute' : 'Mute');
      });
    }
    
    // Set up solo button with track service integration
    const soloButton = trackElement.querySelector('.solo-button');
    if (soloButton) {
      soloButton.addEventListener('click', () => {
        // Use track service to handle soloing (which also updates audio graph)
        const isSolo = trackService.toggleSolo(track.id);
        // Update UI to reflect the solo state
        soloButton.classList.toggle('active', isSolo);
        // Add visual feedback
        soloButton.setAttribute('title', isSolo ? 'Unsolo' : 'Solo');
      });
    }
    
    // Set up delete track button
    const deleteTrackButton = trackElement.querySelector('.delete-track-btn');
    if (deleteTrackButton) {
      deleteTrackButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling to avoid track selection
        removeTrack(track.id);
      });
    }
    
    // Set up volume slider with visual feedback and dynamic control
    const gainSlider = trackElement.querySelector('.gain-slider') as HTMLInputElement;
    const volumeDisplay = trackElement.querySelector('.volume-display') as HTMLElement;
    
    if (gainSlider && volumeDisplay) {
      // Initial volume display value
      const initialVolume = Math.round(track.gainValue * 100);
      volumeDisplay.textContent = `${initialVolume}%`;
      
      // Update volume display and set actual audio volume when slider changes
      gainSlider.addEventListener('input', () => {
        const volume = parseFloat(gainSlider.value);
        
        // Update the track's volume in the audio engine
        trackService.setTrackVolume(track.id, volume);
        
        // Update the volume display with percentage
        const volumePercent = Math.round(volume * 100);
        volumeDisplay.textContent = `${volumePercent}%`;
        
        // Change color based on volume level
        if (volumePercent > 90) {
          volumeDisplay.style.color = '#e74c3c'; // Red for high volumes
        } else if (volumePercent > 70) {
          volumeDisplay.style.color = '#f39c12'; // Orange for medium-high volumes
        } else {
          volumeDisplay.style.color = '#fff'; // White for normal volumes
        }
      });
      
      // Show volume on hover or when interacting
      gainSlider.addEventListener('mouseover', () => {
        volumeDisplay.style.opacity = '1';
      });
      
      gainSlider.addEventListener('focus', () => {
        volumeDisplay.style.opacity = '1';
      });
      
      // Hide volume when mouse leaves or interaction ends
      gainSlider.addEventListener('mouseleave', () => {
        if (document.activeElement !== gainSlider) {
          // Small delay before hiding
          setTimeout(() => {
            volumeDisplay.style.opacity = '0';
          }, 500);
        }
      });
      
      gainSlider.addEventListener('blur', () => {
        // Small delay before hiding
        setTimeout(() => {
          if (!gainSlider.matches(':hover')) {
            volumeDisplay.style.opacity = '0';
          }
        }, 500);
      });
    }
    
    // Set up drag and drop for this track's clip area
    setupTrackDropZone(trackElement.querySelector('.track-clips'));
  }
  
  // Global variables to track selection and clipboard
  let selectedClipId: string | null = null;
  let clipboardData: { 
    clipId: string; 
    trackId: string; 
    startTime: number; 
    duration: number; 
    audioBuffer: AudioBuffer | null;
    name: string;
  } | null = null;
  
  // Function to remove a track
  function removeTrack(trackId: string) {
    console.log(`Removing track ${trackId}`);
    
    // First check if this track has clips
    const track = trackService.getAllTracks().find(t => t.id === trackId);
    const hasClips = track && track.clips.length > 0;
    
    // If the track has clips, confirm before deleting
    if (hasClips) {
      if (!confirm(`This track contains ${track?.clips.length} clip(s). Are you sure you want to delete it?`)) {
        console.log('Track deletion cancelled by user');
        return;
      }
    }
    
    // Remove from the track service data model
    trackService.removeTrack(trackId);
    
    // Remove from the UI
    const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
    if (trackElement) {
      trackElement.remove();
    }
    
    // Clear track selection if this was the selected track
    if (selectedTrackId === trackId) {
      selectedTrackId = null;
      
      // Automatically select another track if available
      const firstTrack = document.querySelector('.track');
      if (firstTrack) {
        firstTrack.classList.add('selected');
        selectedTrackId = firstTrack.getAttribute('data-track-id');
      }
    }
    
    // Update the UI
    updateTrackWidth();
  }

  // Function to remove a clip
  function removeClip(trackId: string, clipId: string) {
    console.log(`Removing clip ${clipId} from track ${trackId}`);
    
    // Remove from the track service data model
    trackService.removeClipFromTrack(trackId, clipId);
    
    // Remove from the UI
    const clipElement = document.querySelector(`[data-clip-id="${clipId}"]`);
    if (clipElement) {
      clipElement.remove();
    }
    
    // Clear selection if this was the selected clip
    if (selectedClipId === clipId) {
      selectedClipId = null;
    }
    
    // Update the track width after removing a clip
    updateTrackWidth();
  }
  
  // Function to copy the selected clip
  function copySelectedClip(): boolean {
    if (!selectedClipId) {
      console.log('No clip selected to copy');
      return false;
    }
    
    const clipElement = document.querySelector(`[data-clip-id="${selectedClipId}"]`) as HTMLElement;
    if (!clipElement) {
      console.log('Selected clip element not found');
      return false;
    }
    
    const trackElement = clipElement.closest('.track');
    if (!trackElement) {
      console.log('Parent track element not found');
      return false;
    }
    
    const trackId = trackElement.getAttribute('data-track-id');
    if (!trackId) {
      console.log('Track ID not found');
      return false;
    }
    
    // Find the clip in the track service
    const track = trackService.getAllTracks().find(t => t.id === trackId);
    if (!track) {
      console.log('Track not found in service');
      return false;
    }
    
    const clip = track.clips.find(c => c.id === selectedClipId);
    if (!clip) {
      console.log('Clip not found in track data');
      return false;
    }
    
    // Store clip data in clipboard
    clipboardData = {
      clipId: clip.id,
      trackId: trackId,
      startTime: clip.startTime,
      duration: clip.duration,
      audioBuffer: clip.buffer,
      name: clip.name
    };
    
    console.log(`Copied clip "${clip.name}" to clipboard`);
    
    // Visual feedback
    // Visual feedback - flash effect
    clipElement.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.7)';
    clipElement.style.transform = 'scale(1.02)';
    setTimeout(() => {
      clipElement.style.boxShadow = '';
      clipElement.style.transform = '';
    }, 300);
    
    // Show toast notification
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = 'Clip copied';
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
    
    return true;
  }
  
  // Function to paste the copied clip to the selected track
  function pasteClipToSelectedTrack(): boolean {
    if (!clipboardData || !clipboardData.audioBuffer) {
      console.log('No valid clip in clipboard');
      return false;
    }
    
    if (!selectedTrackId) {
      console.log('No track selected for paste operation');
      return false;
    }
    
    // Create a new clip based on the clipboard data
    const newClip: AudioClip = {
      id: crypto.randomUUID(),
      buffer: clipboardData.audioBuffer,
      // Position it at cursor or slightly offset from the original
      startTime: clipboardData.startTime, 
      duration: clipboardData.duration,
      offset: 0,
      name: `${clipboardData.name} (copy)`
    };
    
    // Add the clip to the selected track
    addClipToTrack(selectedTrackId, newClip);
    
    console.log(`Pasted clip "${newClip.name}" to track ${selectedTrackId}`);
    
    // Visual feedback for the track
    const trackElement = document.querySelector(`[data-track-id="${selectedTrackId}"]`);
    if (trackElement) {
      trackElement.classList.add('paste-highlight');
      setTimeout(() => {
        trackElement.classList.remove('paste-highlight');
      }, 300);
    }
    
    // Show toast notification
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = 'Clip pasted';
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
    
    return true;
  }
  
  // Function to handle keyboard shortcuts
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Handle delete key (Delete or Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // First priority: If a clip is selected, delete that
        if (selectedClipId) {
          const clipElement = document.querySelector(`[data-clip-id="${selectedClipId}"]`);
          if (clipElement) {
            const trackElement = clipElement.closest('.track');
            if (trackElement) {
              const trackId = trackElement.getAttribute('data-track-id');
              if (trackId) {
                removeClip(trackId, selectedClipId);
                return; // Exit after handling clip deletion
              }
            }
          }
        }
        
        // Second priority: If a track is selected and no clip is selected, delete the track
        if (selectedTrackId && !selectedClipId) {
          removeTrack(selectedTrackId);
        }
      }
      
      // Copy clip with Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (copySelectedClip()) {
          // Prevent default browser copy behavior
          e.preventDefault();
        }
      }
      
      // Paste clip with Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (pasteClipToSelectedTrack()) {
          // Prevent default browser paste behavior
          e.preventDefault();
        }
      }
    });
  }
  
  // Function to add a clip to a track
  function addClipToTrack(trackId: string, clip: AudioClip) {
    console.log(`Adding clip "${clip.name}" to track ${trackId} (using trackService instance: ${audioEngine?.trackService === trackService ? 'FROM_AUDIO_ENGINE' : 'LOCAL'})`);
    trackService.addClipToTrack(trackId, clip);
    
    // Verify clip was added properly
    const track = trackService.getAllTracks().find(t => t.id === trackId);
    if (track) {
      console.log(`Track now has ${track.clips.length} clips`);
    } else {
      console.warn(`Track ${trackId} not found after adding clip`);
    }
    
    const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
    if (!trackElement) return;
    
    const clipContainer = trackElement.querySelector('.track-clips');
    if (!clipContainer) return;
    
    const clipElement = createClipElement(clip, pixelsPerSecond);
    clipContainer.appendChild(clipElement);
    
    // Add event listeners for clip interaction
    clipElement.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      target.classList.add('dragging');
      
      // Store the clip ID and track ID for the drop handler
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          clipId: clip.id,
          trackId: trackId
        }));
      }
    });
    
    clipElement.addEventListener('dragend', (e) => {
      const target = e.target as HTMLElement;
      target.classList.remove('dragging');
    });
    
    // Handle clip selection
    clipElement.addEventListener('clip:select', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { clipId, selected } = customEvent.detail;
      
      // Update the selected clip ID
      selectedClipId = selected ? clipId : null;
      console.log(`Clip ${clipId} ${selected ? 'selected' : 'deselected'}`);
    });
    
    // Handle clip deletion
    clipElement.addEventListener('clip:delete', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { clipId } = customEvent.detail;
      
      removeClip(trackId, clipId);
    });
    
    // Add click-and-drag for repositioning clips
    let isDragging = false;
    let startX = 0;
    let originalLeft = 0;
    
    clipElement.addEventListener('mousedown', (e) => {
      // Don't start dragging if we clicked on a button or action element
      if ((e.target as HTMLElement).closest('.clip-actions')) {
        return;
      }
      
      isDragging = true;
      startX = e.clientX;
      originalLeft = parseInt(clipElement.style.left || '0', 10);
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      
      e.preventDefault(); // Prevent text selection
    });
    
    function onMouseMove(e: MouseEvent) {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const newLeft = Math.max(0, originalLeft + deltaX);
      clipElement.style.left = `${newLeft}px`;
      
      // Update clip data
      const newStartTime = newLeft / pixelsPerSecond;
      clip.startTime = newStartTime;
      
      // Update data attribute for zoom changes
      clipElement.dataset.startTime = newStartTime.toString();
    }
    
    function onMouseUp() {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      // Update the clip position in the track service
      trackService.updateClipPosition(trackId, clip.id, clip.startTime);
    }
  }
  
  // Setup individual track drop zone
  function setupTrackDropZone(dropZone: Element | null) {
    if (!dropZone) return;
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get parent track
        const trackElement = dropZone.closest('.track');
        if (trackElement) {
          // Select this track when dragging over it
          if (trackElement.getAttribute('data-track-id') !== selectedTrackId) {
            // Deselect all tracks
            document.querySelectorAll('.track').forEach(el => {
              el.classList.remove('selected');
            });
            
            // Select this track
            trackElement.classList.add('selected');
            selectedTrackId = trackElement.getAttribute('data-track-id');
            console.log(`Selected track for drop: ${selectedTrackId}`);
          }
        }
        
        dropZone.classList.add('drag-highlight');
      });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-highlight');
      });
    });
    
    // Handle drop on this specific track
    dropZone.addEventListener('drop', async (e) => {
      await handleFileDrop(e, dropZone);
    });
  }
  
  // Handle file drop for audio files
  async function handleFileDrop(e: Event, dropZone: Element) {
    const dragEvent = e as DragEvent;
    if (!dragEvent.dataTransfer?.files.length) return;
    
    console.log(`File drop detected with ${dragEvent.dataTransfer.files.length} files`);
    
    const trackElement = dropZone.closest('.track');
    if (!trackElement) {
      console.warn('No track element found for drop');
      return;
    }
    
    const trackId = trackElement.getAttribute('data-track-id');
    if (!trackId) {
      console.warn('No track ID found for drop');
      return;
    }
    
    console.log(`Files dropped on track ${trackId}`);
    
    // Log file types for debugging
    Array.from(dragEvent.dataTransfer.files).forEach(file => {
      console.log(`File: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`);
    });
    
    const files = Array.from(dragEvent.dataTransfer.files).filter(file => 
      file.type.startsWith('audio/') || 
      file.name.endsWith('.mp3') || 
      file.name.endsWith('.wav') ||
      file.name.endsWith('.ogg') ||
      file.name.endsWith('.aac')
    );
    
    console.log(`Filtered to ${files.length} audio files`);
    
    if (files.length === 0) {
      // Show error styling if no audio files
      console.warn('No audio files found in drop');
      dropZone.classList.add('drag-error');
      setTimeout(() => dropZone.classList.remove('drag-error'), 1500);
      return;
    }
    
    // Calculate position based on drop coordinates
    const rect = dropZone.getBoundingClientRect();
    const dropX = dragEvent.clientX - rect.left;
    const startTime = Math.max(0, dropX / pixelsPerSecond);
    console.log(`Calculated drop position: ${startTime}s (x: ${dropX}px, pixelsPerSecond: ${pixelsPerSecond})`);
    
    // Show loading indicator with message for the file(s) being loaded
    const loader = showLoadingIndicator("Loading audio files...");
    
    // Since mp3 files might take longer to decode, give user feedback
    for (const file of files) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const isMP3 = file.type === 'audio/mp3' || file.type === 'audio/mpeg' || (fileExtension === 'mp3');
      if (isMP3) {
        loader.updateMessage(`Processing MP3 file: ${file.name}`);
      }
    }
    
    try {
      // Process each file sequentially
      for (const file of files) {
        try {
          console.log(`Loading audio file ${file.name}...`);
          
          // Make sure the audio context is running
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('Audio context resumed for file loading');
          }
          
          const audioBuffer = await audioFileService.loadAudioFile(file);
          console.log(`Audio file loaded, duration: ${audioBuffer.duration}s, channels: ${audioBuffer.numberOfChannels}`);
          
          const clip: AudioClip = {
            id: crypto.randomUUID(),
            buffer: audioBuffer,
            startTime,
            duration: audioBuffer.duration,
            offset: 0,
            name: file.name
          };
          
          console.log(`Adding clip to track ${trackId} at ${startTime}s`);
          addClipToTrack(trackId, clip);
          
          // Update track width to accommodate the new clip
          updateTrackWidth();
          
          // Center view on the new clip
          centerViewOnTime(clip.startTime + (clip.duration / 2), pixelsPerSecond);
        } catch (error) {
          console.error(`Error loading audio file ${file.name}:`, error);
          showErrorNotification(`Failed to load "${file.name}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } finally {
      // Hide loading indicator
      hideLoadingIndicator();
    }
  }
  
  // Set up document-level drag and drop handling
  function setupGlobalDragAndDrop() {
    // Prevent default behavior for the entire document
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    
    // Highlight all track-clips when dragging over the document
    document.addEventListener('dragenter', (e) => {
      if (e.dataTransfer?.types.includes('Files')) {
        const trackClips = document.querySelectorAll('.track-clips');
        trackClips.forEach(zone => {
          zone.classList.add('drag-highlight');
        });
      }
    });
    
    document.addEventListener('dragleave', (e) => {
      // Only remove highlight if leaving the document
      if (e.target === document.documentElement) {
        const trackClips = document.querySelectorAll('.track-clips');
        trackClips.forEach(zone => {
          zone.classList.remove('drag-highlight');
        });
      }
    });
    
    document.addEventListener('drop', () => {
      // Remove all highlights on drop
      const trackClips = document.querySelectorAll('.track-clips');
      trackClips.forEach(zone => {
        zone.classList.remove('drag-highlight');
      });
    });
  }
  
  // Initialize drag and drop
  setupGlobalDragAndDrop();
  
  // Add an initial track
  const initialTrack = trackService.addTrack();
  addTrackToUI(initialTrack);
}
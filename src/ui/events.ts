import { createClipElement } from './components/clip';
import { AudioClip } from '../models/audio-clip';
import { AudioTrack } from '../models/audio-track';
import { formatTime } from '../utils/time-formatter';
import { createAudioFileService } from '../services/audio-file-service';
import { createTrackService } from '../services/track-service';
import { createReverbEffect } from '../effects/reverb';
import { createDelayEffect } from '../effects/delay';
import { showLoadingIndicator, hideLoadingIndicator } from './components/loading';

export function setupEventHandlers(
  audioContext: AudioContext,
  masterGainNode: GainNode
): void {
  const trackService = createTrackService(audioContext, masterGainNode);
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
  
  // Transport controls
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
  
  // Add track button
  if (addTrackButton) {
    addTrackButton.addEventListener('click', () => {
      const track = trackService.addTrack();
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
    const loadingIndicator = showLoadingIndicator();
    
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
        } catch (error) {
          console.error(`Error loading audio file ${file.name}:`, error);
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
      timelineCursor.style.left = `${position}px`;
    }
  }
  
  // Add a track to the UI
  function addTrackToUI(track: AudioTrack) {
    if (!tracksContainer) return;
    
    const trackElement = document.createElement('div');
    trackElement.classList.add('track');
    trackElement.dataset.trackId = track.id;
    
    trackElement.innerHTML = `
      <div class="track-header">
        <div class="track-controls">
          <button class="mute-button" title="Mute">M</button>
          <button class="solo-button" title="Solo">S</button>
        </div>
        <div class="track-fader">
          <input type="range" min="0" max="1" step="0.01" value="1" class="gain-slider">
        </div>
      </div>
      <div class="track-clips"></div>
    `;
    
    tracksContainer.appendChild(trackElement);
    
    // Add event listeners for track controls
    const muteButton = trackElement.querySelector('.mute-button');
    if (muteButton) {
      muteButton.addEventListener('click', () => {
        track.muted = !track.muted;
        muteButton.classList.toggle('active', track.muted);
      });
    }
    
    const soloButton = trackElement.querySelector('.solo-button');
    if (soloButton) {
      soloButton.addEventListener('click', () => {
        track.solo = !track.solo;
        soloButton.classList.toggle('active', track.solo);
      });
    }
    
    const gainSlider = trackElement.querySelector('.gain-slider') as HTMLInputElement;
    if (gainSlider) {
      gainSlider.addEventListener('input', () => {
        track.gainValue = parseFloat(gainSlider.value);
      });
    }
    
    // Set up drag and drop for this track's clip area
    setupTrackDropZone(trackElement.querySelector('.track-clips'));
  }
  
  // Function to add a clip to a track
  function addClipToTrack(trackId: string, clip: AudioClip) {
    trackService.addClipToTrack(trackId, clip);
    
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
    
    // Add click-and-drag for repositioning clips
    let isDragging = false;
    let startX = 0;
    let originalLeft = 0;
    
    clipElement.addEventListener('mousedown', (e) => {
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
    dropZone.addEventListener('drop', async (e: DragEvent) => {
      await handleFileDrop(e, dropZone);
    });
  }
  
  // Handle file drop for audio files
  async function handleFileDrop(e: DragEvent, dropZone: Element) {
    if (!e.dataTransfer?.files.length) return;
    
    const trackElement = dropZone.closest('.track');
    if (!trackElement) return;
    
    const trackId = trackElement.getAttribute('data-track-id');
    if (!trackId) return;
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('audio/') || 
      file.name.endsWith('.mp3') || 
      file.name.endsWith('.wav') ||
      file.name.endsWith('.ogg') ||
      file.name.endsWith('.aac')
    );
    
    if (files.length === 0) {
      // Show error styling if no audio files
      dropZone.classList.add('drag-error');
      setTimeout(() => dropZone.classList.remove('drag-error'), 1500);
      return;
    }
    
    // Calculate position based on drop coordinates
    const rect = dropZone.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const startTime = Math.max(0, dropX / pixelsPerSecond);
    
    // Show loading indicator
    const loadingIndicator = showLoadingIndicator();
    
    try {
      // Process each file sequentially
      for (const file of files) {
        try {
          const audioBuffer = await audioFileService.loadAudioFile(file);
          
          const clip: AudioClip = {
            id: crypto.randomUUID(),
            buffer: audioBuffer,
            startTime,
            duration: audioBuffer.duration,
            offset: 0,
            name: file.name
          };
          
          addClipToTrack(trackId, clip);
        } catch (error) {
          console.error(`Error loading audio file ${file.name}:`, error);
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
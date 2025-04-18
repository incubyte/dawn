import { createClipElement } from './components/clip';
import { AudioClip } from '../models/audio-clip';
import { AudioTrack } from '../models/audio-track';
import { formatTime } from '../utils/time-formatter';
import { createAudioFileService } from '../services/audio-file-service';
import { createTrackService } from '../services/track-service';
import { createReverbEffect } from '../effects/reverb';
import { createDelayEffect } from '../effects/delay';

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
  
  // Set up drag and drop area for audio files
  setupDragAndDrop();
  
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
  }
  
  // Setup drag and drop for audio files
  function setupDragAndDrop() {
    const dropZones = document.querySelectorAll('.track-clips');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e: Event) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZones.forEach(zone => {
        zone.addEventListener(eventName, highlight, false);
      });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropZones.forEach(zone => {
        zone.addEventListener(eventName, unhighlight, false);
      });
    });
    
    function highlight(e: Event) {
      const target = e.target as HTMLElement;
      target.classList.add('drag-highlight');
    }
    
    function unhighlight(e: Event) {
      const target = e.target as HTMLElement;
      target.classList.remove('drag-highlight');
    }
    
    // Handle dropped files
    dropZones.forEach(zone => {
      zone.addEventListener('drop', handleDrop, false);
    });
    
    async function handleDrop(e: DragEvent) {
      if (!e.dataTransfer?.files) return;
      
      const trackElement = (e.target as HTMLElement).closest('.track');
      if (!trackElement) return;
      
      const trackId = trackElement.dataset.trackId;
      if (!trackId) return;
      
      const files = e.dataTransfer.files;
      for (const file of Array.from(files)) {
        if (file.type.startsWith('audio/')) {
          try {
            const audioBuffer = await audioFileService.loadAudioFile(file);
            
            // Calculate position based on drop coordinates
            const trackClips = trackElement.querySelector('.track-clips');
            const rect = trackClips?.getBoundingClientRect();
            const trackX = rect ? e.clientX - rect.left : 0;
            const startTime = trackX / pixelsPerSecond;
            
            const clip: AudioClip = {
              id: crypto.randomUUID(),
              buffer: audioBuffer,
              startTime: startTime,
              duration: audioBuffer.duration,
              offset: 0,
              name: file.name
            };
            
            addClipToTrack(trackId, clip);
          } catch (error) {
            console.error('Error loading audio file:', error);
          }
        }
      }
    }
  }
  
  // Add an initial track
  const initialTrack = trackService.addTrack();
  addTrackToUI(initialTrack);
}

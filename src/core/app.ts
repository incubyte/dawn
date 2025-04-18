import { setupUI } from '../ui/ui';
import { setupAudioEngine, AudioEngine } from './audio-engine';
import { createTransportControls } from '../ui/components/transport';
import { createTimeline, updateTimelineCursor } from '../ui/components/timeline';
import { setupEventHandlers } from '../ui/events';
import { formatTime } from '../utils/time-formatter';
import { setupAudioDebug } from '../utils/audio-debug';
import { setupScrollSync, updateTrackWidth } from '../utils/scroll-sync';

export function initializeApp(): void {
  // Initialize audio engine first
  const audioEngine = setupAudioEngine();
  
  // Set up UI with audio engine reference
  setupUI(audioEngine);
  
  // Create transport controls with the audio engine
  createTransportControls(audioEngine);
  
  // Set up timeline with seek capability
  createTimeline({
    pixelsPerSecond: 10,
    totalDuration: 300,
    majorMarkerInterval: 30,
    onSeek: (time) => {
      audioEngine.seekTo(time);
      updateTimelineCursor(time, 10);
    }
  });
  
  // Set up event handlers with the audio engine
  setupEventHandlers(audioEngine.audioContext, audioEngine.masterGainNode, audioEngine);
  
  // Start the animation frame for the timeline cursor
  animateTimelineCursor(audioEngine);
  
  // Listen for timeline zoom changes
  document.addEventListener('timeline:zoom', (e: Event) => {
    const customEvent = e as CustomEvent;
    const { pixelsPerSecond } = customEvent.detail;
    
    // Update any clip positions with the new pixels per second
    updateClipPositions(pixelsPerSecond);
  });
  
  // Add a global click handler to initialize audio context
  document.addEventListener('click', () => {
    // Modern browsers require user interaction to start AudioContext
    if (audioEngine.audioContext.state === 'suspended') {
      audioEngine.audioContext.resume().then(() => {
        console.log('AudioContext started from user interaction');
      });
    }
  }, { once: true });
  
  // Set up audio debugging tools
  setupAudioDebug(audioEngine);
  
  // Set up synchronized scrolling between timeline and tracks
  setupScrollSync();
  
  // Initialize track width
  updateTrackWidth();
  
  // Expose the audio engine globally for debugging
  (window as any).audioEngine = audioEngine;
  
  console.log('Browser DAW initialized');
}

function animateTimelineCursor(audioEngine: AudioEngine): void {
  // Current pixels per second (default)
  let pixelsPerSecond = 10;
  
  // Listen for zoom changes
  document.addEventListener('timeline:zoom', (e: Event) => {
    const customEvent = e as CustomEvent;
    pixelsPerSecond = customEvent.detail.pixelsPerSecond;
  });
  
  // Animation function
  function animate() {
    // Update the cursor position based on current playback time
    updateTimelineCursor(audioEngine.currentTime, pixelsPerSecond);
    
    // Update the time display
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) {
      const formattedTime = formatTime(audioEngine.currentTime);
      timeDisplay.textContent = formattedTime;
    }
    
    requestAnimationFrame(animate);
  }
  
  // Start animation loop
  animate();
}

function updateClipPositions(pixelsPerSecond: number): void {
  // Update all clip positions based on the new zoom level
  const clips = document.querySelectorAll('.audio-clip');
  
  clips.forEach(clip => {
    const clipElement = clip as HTMLElement;
    const startTime = parseFloat(clipElement.dataset.startTime || '0');
    const duration = parseFloat(clipElement.dataset.duration || '0');
    
    clipElement.style.left = `${startTime * pixelsPerSecond}px`;
    clipElement.style.width = `${duration * pixelsPerSecond}px`;
  });
}
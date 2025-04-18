import { setupUI } from '../ui/ui';
import { setupAudioEngine, AudioEngine } from './audio-engine';
import { createTransportControls } from '../ui/components/transport';
import { createTimeline, updateTimelineCursor } from '../ui/components/timeline';
import { setupEventHandlers } from '../ui/events';
import { formatTime } from '../utils/time-formatter';
import { setupAudioDebug } from '../utils/audio-debug';
import { setupScrollSync, updateTrackWidth } from '../utils/scroll-sync';

import { createWelcomeScreen, appSettings, StorageProvider } from '../ui/components/welcome-screen';

export function initializeApp(): void {
  // Prepare the app container
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('App container not found');
    return;
  }
  
  // Create and show the welcome screen
  const welcomeScreen = createWelcomeScreen(
    (action: 'new' | 'load', storageProvider: StorageProvider) => {
      handleWelcomeScreenAction(action, storageProvider, appContainer);
    }
  );
  
  // Clear the app container and add the welcome screen
  appContainer.innerHTML = '';
  appContainer.appendChild(welcomeScreen);
  
  console.log('Welcome screen initialized');
}

function handleWelcomeScreenAction(
  action: 'new' | 'load', 
  storageProvider: StorageProvider, 
  appContainer: HTMLElement
): void {
  console.log(`Welcome screen action: ${action}, storage: ${storageProvider}`);
  
  // Remove the welcome screen
  appContainer.innerHTML = '';
  
  // Create the main DAW container
  const dawContainer = document.createElement('div');
  dawContainer.className = 'daw-container';
  
  // Create the basic structure
  dawContainer.innerHTML = `
    <div class="daw-header">
      <div class="header-left">
        <img src="/dawn_logo.png" alt="DAWN DAW" class="dawn-logo">
      </div>
      <div id="transport-controls" class="transport-controls"></div>
      <div class="header-right">
        <span id="storage-indicator" class="storage-indicator">
          ${storageProvider === 'github' ? '🐙 GitHub' : '💾 Local Storage'}
        </span>
      </div>
    </div>
    <div class="daw-main">
      <div class="timeline">
        <div class="timeline-header"></div>
        <div class="timeline-content">
          <div class="timeline-ruler"></div>
          <div class="timeline-cursor"></div>
        </div>
      </div>
      <div class="track-list">
        <div class="track-controls">
          <button id="add-track-button" class="control-button">Add Track</button>
        </div>
        <div id="tracks-container" class="tracks-container"></div>
      </div>
    </div>
  `;
  
  // Add the DAW container to the app
  appContainer.appendChild(dawContainer);
  
  // Initialize the DAW components
  initializeDAW(action);
}

function initializeDAW(action: 'new' | 'load'): void {
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
  
  // If the action is 'load', automatically open the load dialog based on storage provider
  if (action === 'load') {
    setTimeout(async () => {
      if (appSettings.storageProvider === 'github' && appSettings.githubToken && appSettings.githubRepo) {
        // GitHub loading logic - trigger the load button which now has GitHub support
        console.log('Loading from GitHub:', appSettings.githubRepo);
        const loadButton = document.getElementById('load-button');
        if (loadButton) {
          loadButton.click();
        }
      } else {
        // Local storage loading - trigger the load button click
        const loadButton = document.getElementById('load-button');
        if (loadButton) {
          loadButton.click();
        }
      }
    }, 500);
  }
  
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
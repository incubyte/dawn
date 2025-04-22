import { setupUI } from '../ui/ui';
import { AudioEngine, AudioEngineImpl } from './audio-engine';
import { createTransportControls } from '../ui/components/transport';
import { createTimeline, updateTimelineCursor } from '../ui/components/timeline';
import { setupEventHandlers } from '../ui/events';
import { formatTime } from '../utils/time-formatter';
import { setupAudioDebug } from '../utils/audio-debug';
import { setupScrollSync, updateTrackWidth } from '../utils/scroll-sync';

import { createWelcomeScreen, StorageProvider } from '../ui/components/welcome-screen';
import { assertNotNullOrUndefined } from '../utils/assert';

export function initializeApp(): void {
    const appContainer = document.getElementById('app');
    assertNotNullOrUndefined(appContainer, "[ERROR] Root element not found");

    const welcomeScreen = createWelcomeScreen(
        (action: 'new' | 'load', storageProvider: StorageProvider) => {
            handleWelcomeScreenAction(action, storageProvider, appContainer);
        }
    );
    appContainer.innerHTML = '';
    appContainer.appendChild(welcomeScreen);
    console.log('Welcome screen initialized');
}

function handleWelcomeScreenAction(
    action: 'new' | 'load',
    storageProvider: StorageProvider,
    appContainer: HTMLElement
): void {

    // TODO: Handle storageProvider
    console.log(storageProvider);
    // CLN: CleanUP
    console.log(appContainer);
    initializeDAW(action);
}

function initializeDAW(action: 'new' | 'load'): void {
    const audioEngine: AudioEngine = AudioEngineImpl.instance();

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

    // If the action is 'load', automatically open the load dialog
    if (action === 'load') {
        setTimeout(() => {
            // Local storage loading - trigger the load button click
            const loadButton = document.getElementById('load-button');
            if (loadButton) {
                loadButton.click();
            }
        }, 500);
    }

    // Expose the audio engine globally for debugging
    (window as any).audioEngine = audioEngine;

    console.log('Browser DAW initialized');
}

function getDawContainerHTML(): string {
    return `
    <div class="daw-header">
      <div class="header-left">
        <img src="/dawn_logo.png" alt="DAWN DAW" class="dawn-logo">
      </div>
      <div id="transport-controls" class="transport-controls"></div>
      <div class="header-right">
        <span id="storage-indicator" class="storage-indicator">
          💾 Local Storage
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

import { createTransportControls } from './components/transport';
import { createTrackList } from './components/track-list';
import { createTimeline } from './components/timeline';
import { showImportDialog, onImportConfirmed } from './components/file-import';
import { showLoadingIndicator, hideLoadingIndicator } from './components/loading';

export function setupUI(): void {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div class="daw-container">
      <header class="daw-header">
        <h1>Browser DAW</h1>
        <div id="transport-controls" class="transport-controls"></div>
      </header>
      <main class="daw-main">
        <div id="timeline" class="timeline"></div>
        <div id="track-list" class="track-list">
          <div class="track-controls">
            <button id="import-audio-button" class="control-button">Import Audio</button>
            <button id="add-track-button" class="control-button">Add Track</button>
          </div>
          <div id="tracks-container" class="tracks-container">
            <!-- Tracks will be inserted here -->
          </div>
        </div>
      </main>
    </div>
  `;

  createTransportControls();
  createTrackList();
  createTimeline();
  
  // Setup import button
  const importAudioButton = document.getElementById('import-audio-button');
  if (importAudioButton) {
    importAudioButton.addEventListener('click', () => {
      showImportDialog();
    });
  }
  
  // Setup file import handling
  setupImportHandling();
}

function setupImportHandling(): void {
  // We would normally use the audio engine's context here, but we're delegating to events.ts
  
  onImportConfirmed(async (files) => {
    // Show loading while processing files
    showLoadingIndicator();
    
    try {
      // Get the active track (the last one, for now)
      const tracks = document.querySelectorAll('.track');
      if (tracks.length === 0) {
        alert('No tracks available. Please add a track first.');
        return;
      }
      
      const activeTrack = tracks[tracks.length - 1];
      const trackId = activeTrack.getAttribute('data-track-id');
      if (!trackId) return;
      
      // We would normally use the trackService here, but for simplicity
      // we'll dispatch a custom event that our track service event handler 
      // will catch and process
      const importEvent = new CustomEvent('audio:import', {
        detail: {
          trackId,
          files
        }
      });
      
      document.dispatchEvent(importEvent);
    } finally {
      // Hide loading indicator
      hideLoadingIndicator();
    }
  });
  
  // Handle the import event
  document.addEventListener('audio:import', (e: Event) => {
    const customEvent = e as CustomEvent;
    const { trackId, files } = customEvent.detail;
    
    console.log(`Importing ${files.length} files to track ${trackId}`);
    // The actual import logic happens in events.ts
  });
}
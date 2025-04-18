export function createTrackList(): void {
  const trackListContainer = document.getElementById('track-list');
  if (!trackListContainer) return;

  trackListContainer.innerHTML = `
    <div class="track-controls">
      <button id="add-track-button" class="control-button">
        Add Track
      </button>
    </div>
    <div id="tracks-container" class="tracks-container">
      <!-- Tracks will be inserted here -->
    </div>
  `;

  // Event handlers will be attached in a separate step
}

export function createTrackElement(trackId: string): HTMLElement {
  const trackElement = document.createElement('div');
  trackElement.classList.add('track');
  trackElement.dataset.trackId = trackId;

  trackElement.innerHTML = `
    <div class="track-header">
      <div class="track-controls">
        <button class="mute-button">M</button>
        <button class="solo-button">S</button>
      </div>
      <div class="track-fader">
        <input type="range" min="0" max="1" step="0.01" value="1" class="gain-slider">
      </div>
    </div>
    <div class="track-clips"></div>
  `;

  return trackElement;
}

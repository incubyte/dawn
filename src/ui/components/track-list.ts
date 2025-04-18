export function createTrackList(): void {
  // The track list container is now created in the main UI setup
  // This function is kept for consistency but simplified
  
  const addTrackButton = document.getElementById('add-track-button');
  if (addTrackButton) {
    addTrackButton.addEventListener('click', () => {
      // The click handler is set up in the events.ts file
      // This is just a placeholder
    });
  }
}

export function createTrackElement(trackId: string): HTMLElement {
  const trackElement = document.createElement('div');
  trackElement.classList.add('track');
  trackElement.dataset.trackId = trackId;

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

  return trackElement;
}
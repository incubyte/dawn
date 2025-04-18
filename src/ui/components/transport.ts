export function createTransportControls(): void {
  const transportContainer = document.getElementById('transport-controls');
  if (!transportContainer) return;

  transportContainer.innerHTML = `
    <button id="play-button" class="transport-button" title="Play">
      <span class="icon">▶</span>
    </button>
    <button id="stop-button" class="transport-button" title="Stop">
      <span class="icon">■</span>
    </button>
    <button id="record-button" class="transport-button" title="Record">
      <span class="icon">●</span>
    </button>
    <div class="time-display">
      <span id="current-time">00:00:000</span>
    </div>
    <button id="export-button" class="transport-button" title="Export">
      Export
    </button>
  `;

  // Event handlers will be attached in a separate step
}

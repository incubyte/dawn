import { createTransportControls } from './components/transport';
import { createTrackList } from './components/track-list';
import { createTimeline } from './components/timeline';

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
        <div id="track-list" class="track-list"></div>
      </main>
    </div>
  `;

  createTransportControls();
  createTrackList();
  createTimeline();
}

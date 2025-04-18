import { AudioClip } from '../../models/audio-clip';
import { renderWaveform } from '../../utils/waveform-renderer';

export function createClipElement(clip: AudioClip, pixelsPerSecond: number): HTMLElement {
  const width = clip.duration * pixelsPerSecond;
  const clipElement = document.createElement('div');
  clipElement.classList.add('audio-clip');
  clipElement.dataset.clipId = clip.id;
  clipElement.style.width = `${width}px`;
  clipElement.style.left = `${clip.startTime * pixelsPerSecond}px`;
  
  clipElement.innerHTML = `
    <div class="clip-label">${clip.name}</div>
    <div class="clip-waveform"></div>
  `;
  
  // If we have an audio buffer, render the waveform
  if (clip.buffer) {
    const waveformElement = clipElement.querySelector('.clip-waveform');
    if (waveformElement) {
      const waveformUrl = renderWaveform(clip.buffer, width, 40);
      waveformElement.style.backgroundImage = `url(${waveformUrl})`;
    }
  }
  
  // Make clip draggable
  clipElement.draggable = true;
  
  return clipElement;
}

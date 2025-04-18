import { AudioClip } from '../../models/audio-clip';
import { renderWaveform } from '../../utils/waveform-renderer';

export function createClipElement(clip: AudioClip, pixelsPerSecond: number): HTMLElement {
  const width = clip.duration * pixelsPerSecond;
  const clipElement = document.createElement('div');
  clipElement.classList.add('audio-clip');
  clipElement.dataset.clipId = clip.id;
  clipElement.style.width = `${width}px`;
  clipElement.style.left = `${clip.startTime * pixelsPerSecond}px`;
  
  // Create the clip content
  const labelElement = document.createElement('div');
  labelElement.classList.add('clip-label');
  labelElement.textContent = clip.name;
  
  const waveformElement = document.createElement('div');
  waveformElement.classList.add('clip-waveform');
  
  clipElement.appendChild(labelElement);
  clipElement.appendChild(waveformElement);
  
  // If we have an audio buffer, render the waveform
  if (clip.buffer) {
    // Render waveform asynchronously to avoid blocking the UI
    renderWaveformAsync(clip.buffer, waveformElement, width);
  }
  
  // Make clip draggable
  clipElement.draggable = true;
  
  return clipElement;
}

function renderWaveformAsync(buffer: AudioBuffer, waveformElement: HTMLElement, width: number): void {
  // Use a smaller height for the waveform canvas to improve performance
  const height = 40;
  
  // Use setTimeout to avoid blocking the UI thread
  setTimeout(() => {
    try {
      const waveformUrl = renderWaveform(buffer, width, height);
      waveformElement.style.backgroundImage = `url(${waveformUrl})`;
    } catch (error) {
      console.error('Error rendering waveform:', error);
    }
  }, 100);
}

// Helper function to trim a clip visually and adjust its data
export function trimClip(clipElement: HTMLElement, pixelsPerSecond: number, fromStart: boolean, offsetPixels: number): void {
  const width = parseInt(clipElement.style.width, 10);
  const left = parseInt(clipElement.style.left, 10);
  
  const clipId = clipElement.dataset.clipId;
  if (!clipId) return;
  
  if (fromStart) {
    // Trim from start
    const newLeft = left + offsetPixels;
    const newWidth = width - offsetPixels;
    
    if (newWidth <= 10) return; // Minimum width check
    
    clipElement.style.left = `${newLeft}px`;
    clipElement.style.width = `${newWidth}px`;
    
    // Update clip data would be handled by the track service
  } else {
    // Trim from end
    const newWidth = width - offsetPixels;
    
    if (newWidth <= 10) return; // Minimum width check
    
    clipElement.style.width = `${newWidth}px`;
    
    // Update clip data would be handled by the track service
  }
}
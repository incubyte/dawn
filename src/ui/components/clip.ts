import { AudioClip } from '../../models/audio-clip';
import { renderWaveform } from '../../utils/waveform-renderer';

export function createClipElement(clip: AudioClip, pixelsPerSecond: number): HTMLElement {
  const width = clip.duration * pixelsPerSecond;
  const clipElement = document.createElement('div');
  clipElement.classList.add('audio-clip');
  clipElement.dataset.clipId = clip.id;
  clipElement.dataset.startTime = clip.startTime.toString();
  clipElement.dataset.duration = clip.duration.toString();
  clipElement.style.width = `${width}px`;
  clipElement.style.left = `${clip.startTime * pixelsPerSecond}px`;
  
  // Create the clip content
  const labelElement = document.createElement('div');
  labelElement.classList.add('clip-label');
  
  // Add clip name and action buttons in a layout
  const clipNameSpan = document.createElement('span');
  clipNameSpan.classList.add('clip-name');
  clipNameSpan.textContent = clip.name;
  clipNameSpan.title = clip.name; // For longer names that might be truncated
  
  const actionsDiv = document.createElement('div');
  actionsDiv.classList.add('clip-actions');
  
  // Create delete button
  const deleteButton = document.createElement('button');
  deleteButton.classList.add('clip-delete-btn');
  deleteButton.innerHTML = '✕';
  deleteButton.title = 'Delete clip';
  deleteButton.setAttribute('aria-label', 'Delete clip');
  
  // Prevent click event from bubbling to avoid selecting the clip when clicking delete
  deleteButton.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Dispatch a custom event for deleting the clip
    const deleteEvent = new CustomEvent('clip:delete', {
      bubbles: true,
      detail: {
        clipId: clip.id,
        trackElement: clipElement.closest('.track'),
        clipElement: clipElement
      }
    });
    
    clipElement.dispatchEvent(deleteEvent);
  });
  
  // Add elements to the label
  actionsDiv.appendChild(deleteButton);
  labelElement.appendChild(clipNameSpan);
  labelElement.appendChild(actionsDiv);
  
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
  
  // Make clip selectable - but within its own event handler
  clipElement.addEventListener('click', (e) => {
    // Don't handle clicks on action buttons
    if ((e.target as HTMLElement).closest('.clip-actions')) {
      return;
    }
    
    // Toggle selection state
    const isAlreadySelected = clipElement.classList.contains('selected');
    
    // Clear any other selected clips first
    document.querySelectorAll('.audio-clip.selected').forEach(selectedClip => {
      if (selectedClip !== clipElement) {
        selectedClip.classList.remove('selected');
      }
    });
    
    // If it wasn't already selected, select it now
    if (!isAlreadySelected) {
      clipElement.classList.add('selected');
    } else {
      // If it was already selected, deselect it
      clipElement.classList.remove('selected');
    }
    
    // Dispatch an event for clip selection
    const selectEvent = new CustomEvent('clip:select', {
      bubbles: true,
      detail: {
        clipId: clip.id,
        trackElement: clipElement.closest('.track'),
        clipElement: clipElement,
        selected: !isAlreadySelected
      }
    });
    
    clipElement.dispatchEvent(selectEvent);
  });
  
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
    
    // Update data attributes
    const originalStartTime = parseFloat(clipElement.dataset.startTime || '0');
    const originalDuration = parseFloat(clipElement.dataset.duration || '0');
    const offsetSeconds = offsetPixels / pixelsPerSecond;
    
    clipElement.dataset.startTime = (originalStartTime + offsetSeconds).toString();
    clipElement.dataset.duration = (originalDuration - offsetSeconds).toString();
  } else {
    // Trim from end
    const newWidth = width - offsetPixels;
    
    if (newWidth <= 10) return; // Minimum width check
    
    clipElement.style.width = `${newWidth}px`;
    
    // Update data attributes
    const originalDuration = parseFloat(clipElement.dataset.duration || '0');
    const offsetSeconds = offsetPixels / pixelsPerSecond;
    
    clipElement.dataset.duration = (originalDuration - offsetSeconds).toString();
  }
}
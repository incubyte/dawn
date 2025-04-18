import { AudioClip } from '../../models/audio-clip';
import { renderWaveform } from '../../utils/waveform-renderer';

export function createClipElement(clip: AudioClip, pixelsPerSecond: number): HTMLElement {
  const width = clip.duration * pixelsPerSecond;
  const clipElement = document.createElement('div');
  clipElement.classList.add('audio-clip');
  clipElement.dataset.clipId = clip.id;
  clipElement.dataset.startTime = clip.startTime.toString();
  clipElement.dataset.duration = clip.duration.toString();
  clipElement.dataset.offset = clip.offset.toString();
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
  
  // Add trim handles
  const leftTrimHandle = document.createElement('div');
  leftTrimHandle.classList.add('trim-handle', 'trim-handle-left');
  
  const rightTrimHandle = document.createElement('div');
  rightTrimHandle.classList.add('trim-handle', 'trim-handle-right');
  
  // Add trim guide line
  const trimGuide = document.createElement('div');
  trimGuide.classList.add('trim-guide');
  
  clipElement.appendChild(labelElement);
  clipElement.appendChild(waveformElement);
  clipElement.appendChild(leftTrimHandle);
  clipElement.appendChild(rightTrimHandle);
  clipElement.appendChild(trimGuide);
  
  // If we have an audio buffer, render the waveform
  if (clip.buffer) {
    // Render waveform asynchronously to avoid blocking the UI
    // Pass offset and duration to ensure we're showing the correct portion of audio
    renderWaveformAsync(clip.buffer, waveformElement, width, clip.offset, clip.duration);
  }
  
  // Make clip draggable
  clipElement.draggable = true;
  
  // Make clip selectable - but within its own event handler
  clipElement.addEventListener('click', (e) => {
    // Don't handle clicks on action buttons
    if ((e.target as HTMLElement).closest('.clip-actions')) {
      return;
    }
    
    // Don't handle clicks on trim handles
    if ((e.target as HTMLElement).classList.contains('trim-handle')) {
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
  
  // Setup trim handlers
  setupTrimHandlers(clipElement, leftTrimHandle, rightTrimHandle, trimGuide, clip, pixelsPerSecond);
  
  return clipElement;
}

// Function to set up trim handlers
function setupTrimHandlers(
  clipElement: HTMLElement, 
  leftHandle: HTMLElement, 
  rightHandle: HTMLElement, 
  trimGuide: HTMLElement,
  _clip: AudioClip, // Prefixed with underscore to indicate it's intentionally unused
  pixelsPerSecond: number
): void {
  let isDraggingLeft = false;
  let isDraggingRight = false;
  let startX = 0;
  let originalClipLeft = 0;
  let originalClipWidth = 0;
  let originalClipOffset = 0;
  let originalClipDuration = 0;
  let maxLeftTrim = 0;
  let maxRightTrim = 0;
  
  // Left handle (trim start)
  leftHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation(); // Prevent clip dragging
    clipElement.draggable = false; // Disable dragging during trim
    
    isDraggingLeft = true;
    startX = e.clientX;
    originalClipLeft = parseInt(clipElement.style.left || '0', 10);
    originalClipWidth = parseInt(clipElement.style.width || '0', 10);
    originalClipOffset = parseFloat(clipElement.dataset.offset || '0');
    originalClipDuration = parseFloat(clipElement.dataset.duration || '0');
    
    // Maximum allowed trim is 90% of the clip width (leave at least 10%)
    maxLeftTrim = originalClipWidth * 0.9;
    
    leftHandle.classList.add('active');
    clipElement.classList.add('trimming');
    
    // Show the trim guide at the initial position
    trimGuide.style.left = '0px';
    trimGuide.classList.add('visible');
    
    document.addEventListener('mousemove', onLeftTrimMove);
    document.addEventListener('mouseup', onTrimEnd);
    
    e.preventDefault(); // Prevent text selection
  });
  
  // Right handle (trim end)
  rightHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation(); // Prevent clip dragging
    clipElement.draggable = false; // Disable dragging during trim
    
    isDraggingRight = true;
    startX = e.clientX;
    originalClipWidth = parseInt(clipElement.style.width || '0', 10);
    originalClipDuration = parseFloat(clipElement.dataset.duration || '0');
    
    // Maximum allowed trim is 90% of the clip width (leave at least 10%)
    maxRightTrim = originalClipWidth * 0.9;
    
    rightHandle.classList.add('active');
    clipElement.classList.add('trimming');
    
    // Show the trim guide at the initial position
    trimGuide.style.left = `${originalClipWidth}px`;
    trimGuide.classList.add('visible');
    
    document.addEventListener('mousemove', onRightTrimMove);
    document.addEventListener('mouseup', onTrimEnd);
    
    e.preventDefault(); // Prevent text selection
  });
  
  function onLeftTrimMove(e: MouseEvent) {
    if (!isDraggingLeft) return;
    
    // Calculate trim amount
    const deltaX = e.clientX - startX;
    
    // Limit the trim to avoid making the clip too small
    const trimAmount = Math.min(Math.max(deltaX, 0), maxLeftTrim);
    
    // Update clip position and width in the UI
    const newLeft = originalClipLeft + trimAmount;
    const newWidth = originalClipWidth - trimAmount;
    
    clipElement.style.left = `${newLeft}px`;
    clipElement.style.width = `${newWidth}px`;
    
    // Update the trim guide position
    trimGuide.style.left = `${trimAmount}px`;
    
    // Calculate new values for clip data
    const newOffset = originalClipOffset + (trimAmount / pixelsPerSecond);
    const newDuration = originalClipDuration - (trimAmount / pixelsPerSecond);
    const newStartTime = parseFloat(clipElement.dataset.startTime || '0') + (trimAmount / pixelsPerSecond);
    
    // Update the clip element data attributes (but don't commit to model yet)
    clipElement.dataset.offset = newOffset.toString();
    clipElement.dataset.duration = newDuration.toString();
    clipElement.dataset.startTime = newStartTime.toString();
  }
  
  function onRightTrimMove(e: MouseEvent) {
    if (!isDraggingRight) return;
    
    // Calculate trim amount
    const deltaX = e.clientX - startX;
    
    // Limit the trim to avoid making the clip too small
    const trimAmount = Math.min(Math.max(-deltaX, 0), maxRightTrim);
    
    // Update clip width in the UI
    const newWidth = originalClipWidth - trimAmount;
    
    clipElement.style.width = `${newWidth}px`;
    
    // Update the trim guide position
    trimGuide.style.left = `${newWidth}px`;
    
    // Calculate new value for clip duration
    const newDuration = originalClipDuration - (trimAmount / pixelsPerSecond);
    
    // Update the clip element data attribute (but don't commit to model yet)
    clipElement.dataset.duration = newDuration.toString();
  }
  
  function onTrimEnd() {
    // Remove the active classes
    leftHandle.classList.remove('active');
    rightHandle.classList.remove('active');
    clipElement.classList.remove('trimming');
    
    // Hide the trim guide
    trimGuide.classList.remove('visible');
    
    // Update the clip in the track service
    if (isDraggingLeft || isDraggingRight) {
      // Get the track and clip IDs
      const trackElement = clipElement.closest('.track');
      if (trackElement) {
        const trackId = trackElement.getAttribute('data-track-id');
        const clipId = clipElement.getAttribute('data-clip-id');
        
        if (trackId && clipId) {
          // Get the updated values
          const updatedOffset = parseFloat(clipElement.dataset.offset || '0');
          const updatedDuration = parseFloat(clipElement.dataset.duration || '0');
          const updatedStartTime = parseFloat(clipElement.dataset.startTime || '0');
          
          // Dispatch a trim event to update the model
          const trimEvent = new CustomEvent('clip:trim', {
            bubbles: true,
            detail: {
              trackId,
              clipId,
              startTime: updatedStartTime,
              duration: updatedDuration,
              offset: updatedOffset
            }
          });
          
          clipElement.dispatchEvent(trimEvent);
          
          // Re-render the waveform with the correct portion of the audio buffer
          if (_clip.buffer) {
            const width = parseInt(clipElement.style.width, 10);
            const waveformElement = clipElement.querySelector('.clip-waveform');
            if (waveformElement) {
              // Re-render the waveform with the trimmed portion of the audio
              // Pass the updated offset and duration to show only the relevant part of the audio
              renderWaveformAsync(
                _clip.buffer, 
                waveformElement, 
                width, 
                updatedOffset, // Start offset in seconds
                updatedDuration // Duration in seconds
              );
            }
          }
        }
      }
    }
    
    // Clean up
    isDraggingLeft = false;
    isDraggingRight = false;
    document.removeEventListener('mousemove', onLeftTrimMove);
    document.removeEventListener('mousemove', onRightTrimMove);
    document.removeEventListener('mouseup', onTrimEnd);
    
    // Re-enable dragging
    clipElement.draggable = true;
  }
}

function renderWaveformAsync(
  buffer: AudioBuffer, 
  waveformElement: HTMLElement, 
  width: number, 
  offset?: number, 
  duration?: number
): void {
  // Use a smaller height for the waveform canvas to improve performance
  const height = 40;
  
  // Use setTimeout to avoid blocking the UI thread
  setTimeout(() => {
    try {
      // Convert time offsets to sample offsets if provided
      let offsetSamples: number | undefined;
      let durationSamples: number | undefined;
      
      if (offset !== undefined) {
        offsetSamples = Math.floor(offset * buffer.sampleRate);
      }
      
      if (duration !== undefined) {
        durationSamples = Math.floor(duration * buffer.sampleRate);
      }
      
      const waveformUrl = renderWaveform(buffer, width, height, offsetSamples, durationSamples);
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
  
  let updatedOffset = parseFloat(clipElement.dataset.offset || '0');
  let updatedDuration = parseFloat(clipElement.dataset.duration || '0');
  let updatedStartTime = parseFloat(clipElement.dataset.startTime || '0');
  
  if (fromStart) {
    // Trim from start
    const newLeft = left + offsetPixels;
    const newWidth = width - offsetPixels;
    
    if (newWidth <= 10) return; // Minimum width check
    
    clipElement.style.left = `${newLeft}px`;
    clipElement.style.width = `${newWidth}px`;
    
    // Update data attributes
    const offsetSeconds = offsetPixels / pixelsPerSecond;
    updatedOffset = updatedOffset + offsetSeconds;
    updatedDuration = updatedDuration - offsetSeconds;
    updatedStartTime = updatedStartTime + offsetSeconds;
    
    clipElement.dataset.offset = updatedOffset.toString();
    clipElement.dataset.duration = updatedDuration.toString();
    clipElement.dataset.startTime = updatedStartTime.toString();
  } else {
    // Trim from end
    const newWidth = width - offsetPixels;
    
    if (newWidth <= 10) return; // Minimum width check
    
    clipElement.style.width = `${newWidth}px`;
    
    // Update data attributes
    const offsetSeconds = offsetPixels / pixelsPerSecond;
    updatedDuration = updatedDuration - offsetSeconds;
    
    clipElement.dataset.duration = updatedDuration.toString();
  }
  
  // Dispatch a trim event to update the model
  const trackElement = clipElement.closest('.track');
  if (trackElement) {
    const trackId = trackElement.getAttribute('data-track-id');
    
    if (trackId && clipId) {
      // Dispatch event to update the model
      const trimEvent = new CustomEvent('clip:trim', {
        bubbles: true,
        detail: {
          trackId,
          clipId,
          startTime: updatedStartTime,
          duration: updatedDuration,
          offset: updatedOffset
        }
      });
      
      clipElement.dispatchEvent(trimEvent);
      
      // Look for the buffer to re-render the waveform
      const waveformElement = clipElement.querySelector('.clip-waveform');
      if (waveformElement) {
        // Find the clip in the track service through the event
        document.dispatchEvent(new CustomEvent('request:clip:buffer', {
          bubbles: true,
          detail: {
            trackId,
            clipId,
            callback: (buffer: AudioBuffer | null) => {
              if (buffer) {
                // Re-render the waveform with the correct portion of the audio buffer
                renderWaveformAsync(
                  buffer, 
                  waveformElement, 
                  parseInt(clipElement.style.width, 10),
                  updatedOffset,  // Start offset in seconds
                  updatedDuration // Duration in seconds
                );
              }
            }
          }
        }));
      }
    }
  }
}
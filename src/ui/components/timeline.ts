import { formatTime } from '../../utils/time-formatter';

interface TimelineOptions {
  pixelsPerSecond: number;
  totalDuration: number;
  majorMarkerInterval: number;
  onSeek?: (time: number) => void;
}

export function createTimeline(options: TimelineOptions = {
  pixelsPerSecond: 10,
  totalDuration: 300,
  majorMarkerInterval: 30
}): void {
  const timelineContainer = document.getElementById('timeline');
  if (!timelineContainer) return;

  const {
    pixelsPerSecond,
    totalDuration,
    majorMarkerInterval,
    onSeek
  } = options;

  // Calculate the width of the timeline
  const timelineWidth = totalDuration * pixelsPerSecond;

  timelineContainer.innerHTML = `
    <div class="timeline-header">
      <!-- Empty space to align with track headers -->
    </div>
    <div class="timeline-content">
      <div class="timeline-ruler" style="width: ${timelineWidth}px;">
        <!-- Time markers will be generated here -->
      </div>
      <div class="timeline-cursor"></div>
    </div>
  `;

  generateTimeMarkers(timelineWidth, pixelsPerSecond, totalDuration, majorMarkerInterval);

  // Make timeline seekable
  if (onSeek) {
    const timelineContent = timelineContainer.querySelector('.timeline-content');
    if (timelineContent) {
      timelineContent.addEventListener('click', (e) => {
        const mouseEvent = e as MouseEvent;
        const timelineRect = timelineContent.getBoundingClientRect();
        const clickX = mouseEvent.clientX - timelineRect.left + timelineContainer.scrollLeft;
        const seekTime = clickX / pixelsPerSecond;
        onSeek(seekTime);
      });
    }
  }
}

export function updateTimelineCursor(time: number, pixelsPerSecond: number): void {
  // Update the timeline cursor
  const cursor = document.querySelector('.timeline-content .timeline-cursor');
  if (!cursor) return;

  const position = time * pixelsPerSecond;
  cursor.setAttribute('style', `left: ${position}px`);

  // Get the tracks container element to add/position the playback cursor
  const tracksContainer = document.querySelector('.tracks-container');
  if (!tracksContainer) return;

  // Update or create the playback cursor
  let playbackCursor = document.querySelector('.playback-cursor') as HTMLElement;
  
  if (!playbackCursor) {
    // Create the playback cursor if it doesn't exist
    playbackCursor = document.createElement('div');
    playbackCursor.className = 'playback-cursor';
    tracksContainer.appendChild(playbackCursor); // Add to tracks container
  }
  
  // Calculate the cursor height based on the number of tracks
  const tracks = tracksContainer.querySelectorAll('.track');
  let cursorHeight = 0;
  
  if (tracks.length > 0) {
    // Get the position of the last track's bottom edge
    const lastTrack = tracks[tracks.length - 1] as HTMLElement;
    const lastTrackRect = lastTrack.getBoundingClientRect();
    const tracksContainerRect = tracksContainer.getBoundingClientRect();
    
    // Calculate the height from the top of the tracks container to the bottom of the last track
    cursorHeight = (lastTrackRect.top + lastTrackRect.height) - tracksContainerRect.top;
  } else {
    // If no tracks, just set a default small height
    cursorHeight = 80; // Default track height
  }
  
  // Account for the track header width to ensure alignment with timeline cursor
  // The track header is 200px wide (same as timeline header)
  const headerWidth = 200;
  
  // Position the cursor at the same horizontal position as the timeline cursor
  // But accounting for the header offset in the tracks container
  playbackCursor.style.left = `${position + headerWidth}px`;
  playbackCursor.style.height = `${cursorHeight}px`;

  // Auto-scroll the timeline to keep the cursor visible
  const timeline = document.getElementById('timeline');
  const timelineContent = document.querySelector('.timeline-content');
  
  if (timeline && timelineContent) {
    const timelineRect = timelineContent.getBoundingClientRect();
    const cursorPosition = position;
    
    // Calculate visible area boundaries (account for the header width)
    const headerWidth = 200; // Same as the CSS width
    const leftBoundary = timeline.scrollLeft + 50; // Add some padding
    const rightBoundary = timeline.scrollLeft + timelineRect.width - 50; // Add some padding
    
    // Check if cursor is outside the visible area or close to the edge
    if (cursorPosition < leftBoundary || cursorPosition > rightBoundary) {
      // Scroll to keep cursor centered
      const tracksContainer = document.querySelector('.tracks-container');
      const newScrollPosition = cursorPosition - ((timelineRect.width - headerWidth) / 2);
      
      // Smooth scrolling
      timeline.scrollTo({
        left: newScrollPosition,
        behavior: 'smooth'
      });
      
      // Synchronize tracks container scroll with timeline
      if (tracksContainer) {
        (tracksContainer as HTMLElement).scrollTo({
          left: newScrollPosition,
          behavior: 'smooth'
        });
      }
    }
  }
}

function generateTimeMarkers(
  _timelineWidth: number, // Prefixed with underscore to indicate it's not used
  pixelsPerSecond: number,
  totalDuration: number,
  majorMarkerInterval: number
): void {
  const rulerElement = document.querySelector('.timeline-content .timeline-ruler');
  if (!rulerElement) return;
  
  let html = '';
  
  // Add minor markers every second
  for (let i = 0; i <= totalDuration; i++) {
    const isMajor = i % majorMarkerInterval === 0;
    const markerClass = isMajor ? 'major-marker' : 'minor-marker';
    const position = i * pixelsPerSecond;
    
    html += `<div class="timeline-marker ${markerClass}" style="left: ${position}px;">`;
    
    if (isMajor) {
      // Format time as mm:ss
      html += `<span class="marker-label">${formatTime(i)}</span>`;
    }
    
    html += '</div>';
  }
  
  rulerElement.innerHTML = html;

  // Add zoom controls
  const timeline = document.getElementById('timeline');
  const timelineHeader = document.querySelector('.timeline-header');
  
  if (timeline && timelineHeader) {
    // Create zoom controls container
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    zoomControls.innerHTML = `
      <button class="zoom-in-button" title="Zoom In">+</button>
      <button class="zoom-out-button" title="Zoom Out">-</button>
    `;
    
    // Add to timeline header
    timelineHeader.appendChild(zoomControls);
    
    // Add event listeners
    const zoomInButton = zoomControls.querySelector('.zoom-in-button');
    const zoomOutButton = zoomControls.querySelector('.zoom-out-button');
    
    if (zoomInButton && zoomOutButton) {
      zoomInButton.addEventListener('click', () => {
        // Increase pixels per second
        const newPixelsPerSecond = pixelsPerSecond * 1.5;
        
        // Recreate timeline with new zoom level
        createTimeline({
          pixelsPerSecond: newPixelsPerSecond,
          totalDuration,
          majorMarkerInterval
        });
        
        // Dispatch event to notify about zoom change
        const zoomEvent = new CustomEvent('timeline:zoom', {
          detail: { 
            pixelsPerSecond: newPixelsPerSecond,
            totalDuration
          }
        });
        document.dispatchEvent(zoomEvent);
      });
      
      zoomOutButton.addEventListener('click', () => {
        // Decrease pixels per second, but not below 5
        const newPixelsPerSecond = Math.max(5, pixelsPerSecond / 1.5);
        
        // Recreate timeline with new zoom level
        createTimeline({
          pixelsPerSecond: newPixelsPerSecond,
          totalDuration,
          majorMarkerInterval
        });
        
        // Dispatch event to notify about zoom change
        const zoomEvent = new CustomEvent('timeline:zoom', {
          detail: { 
            pixelsPerSecond: newPixelsPerSecond,
            totalDuration
          }
        });
        document.dispatchEvent(zoomEvent);
      });
    }
  }
}
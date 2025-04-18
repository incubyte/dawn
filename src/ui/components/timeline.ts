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
    <div class="timeline-ruler" style="width: ${timelineWidth}px;">
      <!-- Time markers will be generated here -->
    </div>
    <div class="timeline-cursor"></div>
  `;

  generateTimeMarkers(timelineWidth, pixelsPerSecond, totalDuration, majorMarkerInterval);

  // Make timeline seekable
  if (onSeek) {
    timelineContainer.addEventListener('click', (e) => {
      const timelineRect = timelineContainer.getBoundingClientRect();
      const clickX = e.clientX - timelineRect.left + timelineContainer.scrollLeft;
      const seekTime = clickX / pixelsPerSecond;
      onSeek(seekTime);
    });
  }
}

export function updateTimelineCursor(time: number, pixelsPerSecond: number): void {
  const cursor = document.querySelector('.timeline-cursor');
  if (!cursor) return;

  const position = time * pixelsPerSecond;
  cursor.setAttribute('style', `left: ${position}px`);

  // Auto-scroll the timeline to keep the cursor visible
  const timeline = document.getElementById('timeline');
  if (timeline) {
    const timelineRect = timeline.getBoundingClientRect();
    const cursorPosition = position;
    
    // Calculate visible area boundaries
    const leftBoundary = timeline.scrollLeft + 50; // Add some padding
    const rightBoundary = timeline.scrollLeft + timelineRect.width - 50; // Add some padding
    
    // Check if cursor is outside the visible area or close to the edge
    if (cursorPosition < leftBoundary || cursorPosition > rightBoundary) {
      // Scroll to keep cursor centered
      const tracksContainer = document.querySelector('.tracks-container');
      const newScrollPosition = cursorPosition - (timelineRect.width / 2);
      
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
  const rulerElement = document.querySelector('.timeline-ruler');
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
  if (timeline) {
    // Create zoom controls container
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    zoomControls.innerHTML = `
      <button class="zoom-in-button" title="Zoom In">+</button>
      <button class="zoom-out-button" title="Zoom Out">-</button>
    `;
    
    // Add to timeline
    timeline.appendChild(zoomControls);
    
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
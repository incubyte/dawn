export function createTimeline(): void {
  const timelineContainer = document.getElementById('timeline');
  if (!timelineContainer) return;

  timelineContainer.innerHTML = `
    <div class="timeline-ruler">
      <!-- Time markers will be generated here -->
    </div>
    <div class="timeline-cursor"></div>
  `;

  generateTimeMarkers();
}

function generateTimeMarkers(): void {
  const rulerElement = document.querySelector('.timeline-ruler');
  if (!rulerElement) return;

  // Generate time markers for 5 minutes (300 seconds)
  // with major markers every 30 seconds
  const totalDuration = 300; // in seconds
  const majorMarkerInterval = 30; // in seconds
  const pixelsPerSecond = 10; // 10px per second
  
  let html = '';
  
  for (let i = 0; i <= totalDuration; i++) {
    const isMajor = i % majorMarkerInterval === 0;
    const markerClass = isMajor ? 'major-marker' : 'minor-marker';
    const position = i * pixelsPerSecond;
    
    html += `<div class="timeline-marker ${markerClass}" style="left: ${position}px;">`;
    
    if (isMajor) {
      // Format time as mm:ss
      const minutes = Math.floor(i / 60);
      const seconds = i % 60;
      const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      html += `<span class="marker-label">${timeText}</span>`;
    }
    
    html += '</div>';
  }
  
  rulerElement.innerHTML = html;
}

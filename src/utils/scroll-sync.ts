/**
 * ScrollSync utility to synchronize horizontal scrolling between timeline and tracks
 */

/**
 * Creates synchronized scrolling between the timeline and tracks container
 */
export function setupScrollSync(): void {
  // Get references to the elements that need synchronized scrolling
  const timeline = document.querySelector('.timeline') as HTMLElement;
  const tracksContainer = document.querySelector('.tracks-container') as HTMLElement;
  
  if (!timeline || !tracksContainer) {
    console.warn('Timeline or tracks container not found for scroll sync');
    return;
  }
  
  let isScrolling = false;
  
  // Handle timeline scrolling - sync to tracks
  timeline.addEventListener('scroll', () => {
    if (isScrolling) return;
    
    isScrolling = true;
    
    // Sync tracks container scroll position with timeline
    tracksContainer.scrollLeft = timeline.scrollLeft;
    
    // Prevent infinite scroll loop
    setTimeout(() => {
      isScrolling = false;
    }, 10);
  });
  
  // Also handle tracks container scrolling - sync to timeline
  tracksContainer.addEventListener('scroll', () => {
    if (isScrolling) return;
    
    isScrolling = true;
    
    // Sync timeline scroll position with tracks container
    timeline.scrollLeft = tracksContainer.scrollLeft;
    
    // Prevent infinite scroll loop
    setTimeout(() => {
      isScrolling = false;
    }, 10);
  });
  
  // Update clip container width when zooming
  document.addEventListener('timeline:zoom', (e: Event) => {
    const customEvent = e as CustomEvent;
    const { pixelsPerSecond, totalDuration } = customEvent.detail;
    
    if (pixelsPerSecond && totalDuration) {
      // Calculate the width based on zoom level and total duration
      const width = Math.max(window.innerWidth, pixelsPerSecond * totalDuration);
      
      // Update timeline ruler width
      const timelineRuler = document.querySelector('.timeline-content .timeline-ruler');
      if (timelineRuler) {
        (timelineRuler as HTMLElement).style.width = `${width}px`;
      }
      
      // Update all track clip containers
      const trackClips = document.querySelectorAll('.track-clips');
      trackClips.forEach(clipContainer => {
        (clipContainer as HTMLElement).style.width = `${width}px`;
      });
    }
  });
  
  // Initial width calculation
  updateTrackWidth();
  
  // Update track width when window resizes
  window.addEventListener('resize', () => updateTrackWidth());
}

/**
 * Update the width of the timeline and tracks based on the longest clip
 */
export function updateTrackWidth(minWidth = 3000): void {
  // Set default width
  let width = Math.max(window.innerWidth, minWidth);
  
  // Find longest clip for better width estimation
  const clips = document.querySelectorAll('.audio-clip');
  if (clips.length > 0) {
    clips.forEach(clip => {
      const clipRight = parseInt((clip as HTMLElement).style.left || '0', 10) + 
                       parseInt((clip as HTMLElement).style.width || '0', 10);
      width = Math.max(width, clipRight + 500); // Add some padding
    });
  }
  
  // Update timeline ruler width
  const timelineRuler = document.querySelector('.timeline-content .timeline-ruler');
  if (timelineRuler) {
    (timelineRuler as HTMLElement).style.width = `${width}px`;
  }
  
  // Update all track clip containers
  const trackClips = document.querySelectorAll('.track-clips');
  trackClips.forEach(clipContainer => {
    (clipContainer as HTMLElement).style.width = `${width}px`;
  });
}

/**
 * Centers the view on a specific time position
 */
export function centerViewOnTime(time: number, pixelsPerSecond: number): void {
  const timeline = document.querySelector('.timeline') as HTMLElement;
  if (!timeline) return;
  
  const position = time * pixelsPerSecond;
  const halfWidth = timeline.clientWidth / 2;
  
  // Calculate the scroll position to center the view on the time position
  const scrollPosition = Math.max(0, position - halfWidth);
  
  // Smoothly scroll to the position
  timeline.scrollTo({
    left: scrollPosition,
    behavior: 'smooth'
  });
}
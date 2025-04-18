/**
 * Formats time in seconds to a string in the format MM:SS:mmm
 */
export function formatTime(timeInSeconds: number): string {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Parses a time string in the format MM:SS:mmm to seconds
 */
export function parseTime(timeString: string): number {
  const [minutesStr, secondsStr, millisecondsStr] = timeString.split(':');
  
  const minutes = parseInt(minutesStr, 10) || 0;
  const seconds = parseInt(secondsStr, 10) || 0;
  const milliseconds = parseInt(millisecondsStr, 10) || 0;
  
  return minutes * 60 + seconds + milliseconds / 1000;
}

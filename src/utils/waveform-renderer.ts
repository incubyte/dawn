/**
 * Renders a waveform visualization for an audio buffer
 */
export function renderWaveform(audioBuffer: AudioBuffer, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  
  // Use the first channel data (left channel for stereo)
  const data = audioBuffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j] || 0;
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    
    // Convert from -1...1 to 0...height
    const y1 = ((1 + min) * height) / 2;
    const y2 = ((1 + max) * height) / 2;
    
    ctx.fillRect(i, y1, 1, y2 - y1);
  }
  
  return canvas.toDataURL('image/png');
}

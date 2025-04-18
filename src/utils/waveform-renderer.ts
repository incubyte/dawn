/**
 * Renders a waveform visualization for an audio buffer
 * @param audioBuffer The audio buffer to render
 * @param width The width of the resulting waveform image
 * @param height The height of the resulting waveform image
 * @param offsetSamples Optional start offset in samples (for rendering trimmed clips)
 * @param durationSamples Optional duration in samples (for rendering trimmed clips)
 */
export function renderWaveform(
  audioBuffer: AudioBuffer, 
  width: number, 
  height: number, 
  offsetSamples?: number,
  durationSamples?: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  
  // Use the first channel data (left channel for stereo)
  const data = audioBuffer.getChannelData(0);
  
  // Calculate the portion of the buffer to use
  const startSample = offsetSamples || 0;
  const endSample = durationSamples ? startSample + durationSamples : data.length;
  
  // Calculate step size based on the portion we're rendering
  const sampleCount = endSample - startSample;
  const step = Math.ceil(sampleCount / width);
  
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    
    for (let j = 0; j < step; j++) {
      const sampleIndex = startSample + (i * step) + j;
      if (sampleIndex >= endSample) break;
      
      const datum = data[sampleIndex] || 0;
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

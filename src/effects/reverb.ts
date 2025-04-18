import { Effect, EffectType } from '../models/effect';

export function createReverbEffect(audioContext: AudioContext): Effect {
  const convolver = audioContext.createConvolver();
  
  // Generate simple impulse response for reverb
  const impulseLength = audioContext.sampleRate * 2; // 2 seconds
  const impulse = audioContext.createBuffer(
    2, // stereo
    impulseLength,
    audioContext.sampleRate
  );
  
  // Fill with decay
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      // Decay curve
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 1.5);
    }
  }
  
  convolver.buffer = impulse;
  
  return {
    id: crypto.randomUUID(),
    type: EffectType.Reverb,
    parameters: [
      {
        name: 'Mix',
        value: 0.3,
        min: 0,
        max: 1,
        step: 0.01
      },
      {
        name: 'Time',
        value: 2,
        min: 0.1,
        max: 10,
        step: 0.1
      }
    ],
    bypass: false,
    node: convolver
  };
}

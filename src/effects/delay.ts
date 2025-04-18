import { Effect, EffectType, EffectParameter } from '../models/effect';

export function createDelayEffect(audioContext: AudioContext): Effect {
  const delay = audioContext.createDelay();
  delay.delayTime.value = 0.5; // 500ms delay
  
  const feedback = audioContext.createGain();
  feedback.gain.value = 0.4; // 40% feedback
  
  // Connect delay and feedback
  delay.connect(feedback);
  feedback.connect(delay);
  
  return {
    id: crypto.randomUUID(),
    type: EffectType.Delay,
    parameters: [
      {
        name: 'Time',
        value: 0.5, // 500ms
        min: 0.01,
        max: 2,
        step: 0.01
      },
      {
        name: 'Feedback',
        value: 0.4,
        min: 0,
        max: 0.95,
        step: 0.01
      },
      {
        name: 'Mix',
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.01
      }
    ],
    bypass: false,
    node: delay
  };
}

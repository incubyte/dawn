import { setupUI } from '../ui/ui';
import { setupAudioEngine } from './audio-engine';
import { setupEventHandlers } from '../ui/events';

export function initializeApp(): void {
  // Set up UI
  setupUI();
  
  // Initialize audio engine
  const audioEngine = setupAudioEngine();
  
  // Set up event handlers
  setupEventHandlers(audioEngine.audioContext, audioEngine.masterGainNode);
  
  console.log('Browser DAW initialized');
}

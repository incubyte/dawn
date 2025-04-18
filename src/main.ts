import './styles/index.css';
import { initializeApp } from './core/app';

// Ensure we initialize the app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded, initializing application...');
  initializeApp();
  
  // Add a global click handler to ensure audio context starts
  // This is needed because many browsers require a user gesture to start AudioContext
  document.addEventListener('click', function audioContextStarter() {
    console.log('User interaction detected, ensuring audio context is running');
    document.querySelectorAll('*').forEach(el => {
      if (el && (el as any).audioContext instanceof AudioContext) {
        const ctx = (el as any).audioContext;
        if (ctx.state === 'suspended') {
          console.log('Found suspended AudioContext, attempting to resume');
          ctx.resume().then(() => console.log('AudioContext resumed via user interaction'));
        }
      }
    });
    
    // Only need to do this once
    document.removeEventListener('click', audioContextStarter);
  });
  
  console.log('Application initialization complete');
  
  // Set up debug panel toggle - Press D key to show/hide debug panel
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd' && e.ctrlKey) {
      const debugCheckbox = document.getElementById('show-debug-logs') as HTMLInputElement;
      if (debugCheckbox) {
        debugCheckbox.checked = !debugCheckbox.checked;
        const debugPanel = document.getElementById('audio-debug');
        if (debugPanel) {
          debugPanel.style.display = debugCheckbox.checked ? 'block' : 'none';
        }
      }
    }
  });
});

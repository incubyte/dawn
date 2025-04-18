import { AudioEngine } from '../../core/audio-engine';

// Define storage provider types
export type StorageProvider = 'local' | null;

// Interface for storage option
interface StorageOption {
  id: StorageProvider;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
}

// Interface to store app settings
export interface AppSettings {
  storageProvider: StorageProvider;
}

// Global settings to persist through the session
export const appSettings: AppSettings = {
  storageProvider: null
};

// Function to create the welcome screen
export function createWelcomeScreen(
  onComplete: (action: 'new' | 'load', storageProvider: StorageProvider) => void,
  audioEngine?: AudioEngine
): HTMLElement {
  const welcomeContainer = document.createElement('div');
  welcomeContainer.className = 'welcome-screen';
  
  // Storage options
  const storageOptions: StorageOption[] = [
    {
      id: 'local',
      name: 'Local Storage',
      description: 'Save projects to your device',
      icon: '💾',
      enabled: true
    }
  ];
  
  // Create welcome screen content
  welcomeContainer.innerHTML = `
    <div class="welcome-content">
      <div class="welcome-header">
        <img src="/dawn_logo.png" alt="DAWN DAW" class="welcome-logo">
        <h1>Welcome to DAWN</h1>
        <p class="subtitle">Digital Audio Workstation for the Web</p>
      </div>
      
      <div class="actions-container">
        <div class="welcome-section">
          <h2>Create or Load Project</h2>
          <div class="action-buttons">
            <button id="new-project-btn" class="action-button">
              <span class="button-icon">📝</span>
              <span class="button-text">New Project</span>
            </button>
            <button id="load-project-btn" class="action-button">
              <span class="button-icon">📂</span>
              <span class="button-text">Load Project</span>
            </button>
          </div>
        </div>
        
        <div class="welcome-section">
          <h2>Storage Location</h2>
          <div class="storage-options">
            ${storageOptions.map(option => `
              <div class="storage-option ${option.enabled ? '' : 'disabled'}" data-storage-id="${option.id}">
                <div class="storage-icon">${option.icon}</div>
                <div class="storage-details">
                  <h3>${option.name}</h3>
                  <p>${option.description}</p>
                </div>
                <div class="storage-selector">
                  <input type="radio" name="storage-provider" id="storage-${option.id}" 
                    value="${option.id}" ${option.enabled ? '' : 'disabled'} checked>
                  <span class="checkmark"></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners after attaching to DOM
  setTimeout(() => {
    // New project button
    const newProjectBtn = welcomeContainer.querySelector('#new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        // Since we only have local storage now, just set it directly
        appSettings.storageProvider = 'local';
        onComplete('new', 'local');
      });
    }
    
    // Load project button
    const loadProjectBtn = welcomeContainer.querySelector('#load-project-btn');
    if (loadProjectBtn) {
      loadProjectBtn.addEventListener('click', () => {
        // Since we only have local storage now, just set it directly
        appSettings.storageProvider = 'local';
        onComplete('load', 'local');
      });
    }
    
    // Since we've simplified to only local storage, we don't need complex event handlers
    // Default to local storage selected
    const localStorageRadio = welcomeContainer.querySelector('#storage-local') as HTMLInputElement;
    if (localStorageRadio) {
      localStorageRadio.checked = true;
    }
    
  }, 0);
  
  return welcomeContainer;
}

// Since we've removed GitHub integration, we don't need these helper functions

// Helper function to show an error message
function showError(message: string): void {
  console.error('Welcome screen error:', message);
  
  // Remove any existing error messages
  const existingErrors = document.querySelectorAll('.welcome-error');
  existingErrors.forEach(el => {
    document.body.removeChild(el);
  });
  
  // Create the error element
  const errorElement = document.createElement('div');
  errorElement.className = 'welcome-error';
  errorElement.innerHTML = `
    <div class="error-content">
      <span class="error-icon">⚠️</span>
      <span class="error-message">${message}</span>
      <button class="error-close">×</button>
    </div>
  `;
  
  document.body.appendChild(errorElement);
  
  // Add close button handler
  const closeButton = errorElement.querySelector('.error-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      errorElement.classList.remove('visible');
      setTimeout(() => {
        document.body.removeChild(errorElement);
      }, 300);
    });
  }
  
  // Show the error with longer display time for GitHub errors
  setTimeout(() => {
    errorElement.classList.add('visible');
    
    // Automatically remove after a delay if not manually closed
    if (message.includes('GitHub') || message.includes('token') || message.includes('repository')) {
      // Longer delay for GitHub-related errors (5 seconds)
      setTimeout(() => {
        errorElement.classList.remove('visible');
        setTimeout(() => {
          if (document.body.contains(errorElement)) {
            document.body.removeChild(errorElement);
          }
        }, 300);
      }, 5000);
    } else {
      // Standard delay for other errors (3 seconds)
      setTimeout(() => {
        errorElement.classList.remove('visible');
        setTimeout(() => {
          if (document.body.contains(errorElement)) {
            document.body.removeChild(errorElement);
          }
        }, 300);
      }, 3000);
    }
  }, 10);
}
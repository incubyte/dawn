// Define storage provider types (only local now)
export type StorageProvider = 'local' | null;

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
  onComplete: (action: 'new' | 'load', storageProvider: StorageProvider) => void
): HTMLElement {
  const welcomeContainer = document.createElement('div');
  welcomeContainer.className = 'welcome-screen';
  
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
      </div>
    </div>
  `;
  
  // Add event listeners after attaching to DOM
  setTimeout(() => {
    // New project button
    const newProjectBtn = welcomeContainer.querySelector('#new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        // Set storage to local and continue
        appSettings.storageProvider = 'local';
        onComplete('new', 'local');
      });
    }
    
    // Load project button
    const loadProjectBtn = welcomeContainer.querySelector('#load-project-btn');
    if (loadProjectBtn) {
      loadProjectBtn.addEventListener('click', () => {
        // Set storage to local and continue
        appSettings.storageProvider = 'local';
        onComplete('load', 'local');
      });
    }
  }, 0);
  
  return welcomeContainer;
}


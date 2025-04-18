import { AudioEngine } from '../../core/audio-engine';

// Define storage provider types
export type StorageProvider = 'local' | 'github' | null;

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
  githubToken?: string;
  githubRepo?: string;
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
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Save projects to a GitHub repository',
      icon: '🐙',
      enabled: true // You can disable this if needed
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
                    value="${option.id}" ${option.enabled ? '' : 'disabled'}>
                  <span class="checkmark"></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div id="github-settings" class="welcome-section" style="display: none;">
          <h2>GitHub Settings</h2>
          <div class="github-form">
            <div class="form-group">
              <label for="github-token">Personal Access Token (with repo scope)</label>
              <input type="password" id="github-token" placeholder="ghp_...">
            </div>
            <div class="form-group">
              <label for="github-repo">Repository (username/repo)</label>
              <input type="text" id="github-repo" placeholder="username/repository">
            </div>
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
      newProjectBtn.addEventListener('click', async () => {
        const selectedStorage = getSelectedStorage(welcomeContainer);
        if (selectedStorage) {
          appSettings.storageProvider = selectedStorage;
          
          // If GitHub is selected, save and validate GitHub settings
          if (selectedStorage === 'github') {
            // Show loading state
            newProjectBtn.textContent = 'Validating...';
            (newProjectBtn as HTMLButtonElement).disabled = true;
            
            try {
              const isValid = await saveGitHubSettings(welcomeContainer);
              if (!isValid) {
                // Reset button if validation fails
                newProjectBtn.innerHTML = '<span class="button-icon">📝</span><span class="button-text">New Project</span>';
                (newProjectBtn as HTMLButtonElement).disabled = false;
                return;
              }
            } catch (error) {
              console.error('Error validating GitHub settings:', error);
              showError('Failed to connect to GitHub. Please check your credentials.');
              // Reset button
              newProjectBtn.innerHTML = '<span class="button-icon">📝</span><span class="button-text">New Project</span>';
              (newProjectBtn as HTMLButtonElement).disabled = false;
              return;
            }
          }
          
          // Proceed with the action
          onComplete('new', selectedStorage);
        } else {
          showError('Please select a storage location');
        }
      });
    }
    
    // Load project button
    const loadProjectBtn = welcomeContainer.querySelector('#load-project-btn');
    if (loadProjectBtn) {
      loadProjectBtn.addEventListener('click', async () => {
        const selectedStorage = getSelectedStorage(welcomeContainer);
        if (selectedStorage) {
          appSettings.storageProvider = selectedStorage;
          
          // If GitHub is selected, save and validate GitHub settings
          if (selectedStorage === 'github') {
            // Show loading state
            loadProjectBtn.textContent = 'Validating...';
            (loadProjectBtn as HTMLButtonElement).disabled = true;
            
            try {
              const isValid = await saveGitHubSettings(welcomeContainer);
              if (!isValid) {
                // Reset button if validation fails
                loadProjectBtn.innerHTML = '<span class="button-icon">📂</span><span class="button-text">Load Project</span>';
                (loadProjectBtn as HTMLButtonElement).disabled = false;
                return;
              }
            } catch (error) {
              console.error('Error validating GitHub settings:', error);
              showError('Failed to connect to GitHub. Please check your credentials.');
              // Reset button
              loadProjectBtn.innerHTML = '<span class="button-icon">📂</span><span class="button-text">Load Project</span>';
              (loadProjectBtn as HTMLButtonElement).disabled = false;
              return;
            }
          }
          
          // Proceed with the action
          onComplete('load', selectedStorage);
        } else {
          showError('Please select a storage location');
        }
      });
    }
    
    // Storage option click handlers
    const storageOptions = welcomeContainer.querySelectorAll('.storage-option');
    storageOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const storageId = option.getAttribute('data-storage-id') as StorageProvider;
        const isDisabled = option.classList.contains('disabled');
        
        if (!isDisabled) {
          // Select the radio button
          const radio = welcomeContainer.querySelector(
            `#storage-${storageId}`
          ) as HTMLInputElement;
          
          if (radio) {
            radio.checked = true;
            
            // Show/hide GitHub settings if applicable
            toggleGitHubSettings(welcomeContainer, storageId);
          }
        }
      });
    });
    
    // Radio button change handlers
    const radioButtons = welcomeContainer.querySelectorAll('input[name="storage-provider"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const storageId = (e.target as HTMLInputElement).value as StorageProvider;
        toggleGitHubSettings(welcomeContainer, storageId);
      });
    });
    
    // Default to local storage selected
    const localStorageRadio = welcomeContainer.querySelector('#storage-local') as HTMLInputElement;
    if (localStorageRadio) {
      localStorageRadio.checked = true;
      toggleGitHubSettings(welcomeContainer, 'local');
    }
    
  }, 0);
  
  return welcomeContainer;
}

// Helper function to get the selected storage provider
function getSelectedStorage(container: HTMLElement): StorageProvider {
  const selectedRadio = container.querySelector(
    'input[name="storage-provider"]:checked'
  ) as HTMLInputElement;
  
  return selectedRadio ? selectedRadio.value as StorageProvider : null;
}

// Helper function to toggle GitHub settings visibility
function toggleGitHubSettings(container: HTMLElement, storageId: StorageProvider): void {
  const githubSettings = container.querySelector('#github-settings');
  if (githubSettings) {
    githubSettings.style.display = storageId === 'github' ? 'block' : 'none';
  }
}

// Helper function to save GitHub settings
async function saveGitHubSettings(container: HTMLElement): Promise<boolean> {
  const tokenInput = container.querySelector('#github-token') as HTMLInputElement;
  const repoInput = container.querySelector('#github-repo') as HTMLInputElement;
  
  if (tokenInput && repoInput && tokenInput.value && repoInput.value) {
    // Save the GitHub settings to appSettings
    appSettings.githubToken = tokenInput.value;
    appSettings.githubRepo = repoInput.value;
    
    console.log('GitHub settings saved:', { 
      token: tokenInput.value ? '***' : undefined, 
      repo: repoInput.value 
    });
    
    // Validate GitHub credentials
    try {
      // Dynamically import to avoid circular dependencies
      const { GitHubService } = await import('../../services/github-service');
      const githubService = new GitHubService();
      
      // Validate credentials
      console.log('Validating GitHub credentials...');
      const isValid = await githubService.validateCredentials();
      console.log('GitHub credentials validation result:', isValid);
      
      if (!isValid) {
        showError('Unable to connect to GitHub. Please check your token and repository.');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating GitHub credentials:', error);
      showError('Error connecting to GitHub: ' + (error as Error).message);
      return false;
    }
  } else {
    if (!tokenInput?.value) {
      showError('Please enter a GitHub Personal Access Token');
    } else if (!repoInput?.value) {
      showError('Please enter a GitHub repository (username/repo)');
    }
    return false;
  }
}

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
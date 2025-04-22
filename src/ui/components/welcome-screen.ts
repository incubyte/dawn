export type StorageProvider = 'local' | null;

interface StorageOption {
    id: StorageProvider;
    name: string;
    description: string;
    icon: string;
    enabled: boolean;
}

export interface AppSettings {
    storageProvider: StorageProvider;
}

export const appSettings: AppSettings = {
    storageProvider: null
};

export function createWelcomeScreen(
    onComplete: (action: 'new' | 'load', storageProvider: StorageProvider) => void
): HTMLElement {
    const welcomeContainer = document.createElement('div');
    welcomeContainer.className = 'welcome-screen';

    const storageOptions: StorageOption[] = [
        {
            id: 'local',
            name: 'Local Storage',
            description: 'Save projects to your device',
            icon: '💾',
            enabled: true
        }
    ];

    welcomeContainer.innerHTML = getWelcomeScreenInnerHTML(storageOptions);
    setTimeout(() => {
        setStorageOption(welcomeContainer);
        addEventListeners(welcomeContainer, onComplete);
    }, 0);

    return welcomeContainer;
}

function setStorageOption(welcomeContainer: HTMLElement) {
    const localStorageRadio = welcomeContainer.querySelector('#storage-local') as HTMLInputElement;
    if (localStorageRadio) {
        localStorageRadio.checked = true;
    }
}

function addEventListeners(welcomeContainer: HTMLElement, onComplete: Function) {
    const newProjectBtn = welcomeContainer.querySelector('#new-project-btn');
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', () => {
            appSettings.storageProvider = 'local';
            onComplete('new', 'local');
        });
    }
    const loadProjectBtn = welcomeContainer.querySelector('#load-project-btn');
    if (loadProjectBtn) {
        loadProjectBtn.addEventListener('click', () => {
            // Since we only have local storage now, just set it directly
            appSettings.storageProvider = 'local';
            onComplete('load', 'local');
        });
    }
}

function getWelcomeScreenInnerHTML(storageOptions: StorageOption[]): string {
    return `
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

}

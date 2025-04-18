/**
 * Creates and shows a loading indicator
 * 
 * @param message Optional message to display
 * @returns The loading indicator element and a function to update the message
 */
export function showLoadingIndicator(message?: string): { element: HTMLElement, updateMessage: (newMessage: string) => void } {
  const existingIndicator = document.querySelector('.loading-indicator');
  if (existingIndicator) return {
    element: existingIndicator as HTMLElement,
    updateMessage: (newMessage: string) => {
      const msgElement = existingIndicator.querySelector('.loading-message');
      if (msgElement) msgElement.textContent = newMessage;
    }
  };
  
  const loadingIndicator = document.createElement('div');
  loadingIndicator.classList.add('loading-indicator');
  
  const spinner = document.createElement('div');
  spinner.classList.add('loading-spinner');
  
  loadingIndicator.appendChild(spinner);
  
  // Add message if provided
  let messageElement: HTMLElement | null = null;
  if (message) {
    messageElement = document.createElement('div');
    messageElement.classList.add('loading-message');
    messageElement.textContent = message;
    loadingIndicator.appendChild(messageElement);
  }
  
  document.body.appendChild(loadingIndicator);
  
  return {
    element: loadingIndicator,
    updateMessage: (newMessage: string) => {
      if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.classList.add('loading-message');
        loadingIndicator.appendChild(messageElement);
      }
      messageElement.textContent = newMessage;
    }
  };
}

/**
 * Shows an error notification to the user
 * 
 * @param message Error message to display
 * @param duration Time in ms to show the notification
 */
export function showErrorNotification(message: string, duration: number = 5000): void {
  // Create notification element
  const notification = document.createElement('div');
  notification.classList.add('error-notification');
  
  // Add message
  notification.textContent = message;
  
  // Add to DOM
  document.body.appendChild(notification);
  
  // Add visible class after a small delay for animation
  setTimeout(() => {
    notification.classList.add('visible');
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    notification.classList.remove('visible');
    
    // Remove from DOM after transition completes
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, duration);
}

/**
 * Hides the loading indicator
 */
export function hideLoadingIndicator(): void {
  const loadingIndicator = document.querySelector('.loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
}

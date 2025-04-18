/**
 * Creates and shows a loading indicator
 */
export function showLoadingIndicator(): HTMLElement {
  const existingIndicator = document.querySelector('.loading-indicator');
  if (existingIndicator) return existingIndicator as HTMLElement;
  
  const loadingIndicator = document.createElement('div');
  loadingIndicator.classList.add('loading-indicator');
  
  const spinner = document.createElement('div');
  spinner.classList.add('loading-spinner');
  
  loadingIndicator.appendChild(spinner);
  document.body.appendChild(loadingIndicator);
  
  return loadingIndicator;
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

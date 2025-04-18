/**
 * Creates a dialog for importing audio files
 */
export function createImportDialog(): HTMLElement {
  // Check if import dialog already exists
  const existingDialog = document.getElementById('import-dialog');
  if (existingDialog) return existingDialog as HTMLElement;
  
  // Create dialog container
  const dialogContainer = document.createElement('div');
  dialogContainer.id = 'import-dialog';
  dialogContainer.className = 'modal-dialog';
  
  // Create dialog content
  dialogContainer.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Import Audio Files</h2>
        <button class="close-button">&times;</button>
      </div>
      <div class="modal-body">
        <p>Drag audio files here or click to browse</p>
        <div class="drop-area">
          <div class="drop-message">Drop audio files here</div>
          <input type="file" id="file-input" accept="audio/*" multiple style="display: none">
        </div>
        <div class="selected-files">
          <h3>Selected Files</h3>
          <ul id="file-list"></ul>
        </div>
      </div>
      <div class="modal-footer">
        <button id="cancel-import" class="dialog-button">Cancel</button>
        <button id="confirm-import" class="dialog-button primary-button">Import</button>
      </div>
    </div>
  `;
  
  // Append to body
  document.body.appendChild(dialogContainer);
  
  // Setup event handlers
  const closeButton = dialogContainer.querySelector('.close-button');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      closeImportDialog(dialogContainer);
    });
  }
  
  const cancelButton = dialogContainer.querySelector('#cancel-import');
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      closeImportDialog(dialogContainer);
    });
  }
  
  const dropArea = dialogContainer.querySelector('.drop-area');
  const fileInput = dialogContainer.querySelector('#file-input') as HTMLInputElement;
  
  if (dropArea && fileInput) {
    // Clicking on drop area triggers file input
    dropArea.addEventListener('click', () => {
      fileInput.click();
    });
    
    // Setup drag and drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.add('highlight');
      });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.remove('highlight');
      });
    });
    
    // Handle dropped files
    dropArea.addEventListener('drop', (e: DragEvent) => {
      if (e.dataTransfer?.files) {
        handleSelectedFiles(e.dataTransfer.files, dialogContainer);
      }
    });
    
    // Handle file selection via input
    fileInput.addEventListener('change', () => {
      if (fileInput.files) {
        handleSelectedFiles(fileInput.files, dialogContainer);
      }
    });
  }
  
  return dialogContainer;
}

/**
 * Shows the import dialog
 */
export function showImportDialog(): void {
  const dialog = createImportDialog();
  dialog.classList.add('visible');
}

/**
 * Closes the import dialog
 */
function closeImportDialog(dialog: HTMLElement): void {
  dialog.classList.remove('visible');
  
  // Clear selected files
  const fileList = dialog.querySelector('#file-list');
  if (fileList) {
    fileList.innerHTML = '';
  }
  
  // Reset file input
  const fileInput = dialog.querySelector('#file-input') as HTMLInputElement;
  if (fileInput) {
    fileInput.value = '';
  }
}

/**
 * Handles selected files
 */
function handleSelectedFiles(files: FileList, dialog: HTMLElement): void {
  const fileList = dialog.querySelector('#file-list');
  if (!fileList) return;
  
  fileList.innerHTML = '';
  
  // Filter to only include audio files
  const audioFiles = Array.from(files).filter(file => 
    file.type.startsWith('audio/') || 
    file.name.endsWith('.mp3') || 
    file.name.endsWith('.wav') ||
    file.name.endsWith('.ogg') ||
    file.name.endsWith('.aac')
  );
  
  if (audioFiles.length === 0) {
    fileList.innerHTML = '<li class="no-files">No audio files selected</li>';
    return;
  }
  
  // Add files to the list
  audioFiles.forEach(file => {
    const listItem = document.createElement('li');
    listItem.className = 'file-item';
    listItem.innerHTML = `
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
    `;
    fileList.appendChild(listItem);
  });
  
  // Store files for later use
  (dialog as any).selectedFiles = audioFiles;
  
  // Enable import button
  const importButton = dialog.querySelector('#confirm-import');
  if (importButton) {
    importButton.removeAttribute('disabled');
  }
}

/**
 * Formats file size to human readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}

/**
 * Gets the selected files from the import dialog
 */
export function getSelectedFiles(): File[] {
  const dialog = document.getElementById('import-dialog');
  if (!dialog) return [];
  
  return (dialog as any).selectedFiles || [];
}

/**
 * Adds a callback for when files are imported
 */
export function onImportConfirmed(callback: (files: File[]) => void): void {
  const dialog = createImportDialog();
  
  const confirmButton = dialog.querySelector('#confirm-import');
  if (confirmButton) {
    confirmButton.addEventListener('click', () => {
      const files = getSelectedFiles();
      if (files.length > 0) {
        callback(files);
        closeImportDialog(dialog);
      }
    });
  }
}
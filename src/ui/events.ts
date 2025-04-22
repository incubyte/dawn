import { createClipElement } from './components/clip';
import { AudioClip } from '../models/audio-clip';
import { AudioTrack } from '../models/audio-track';
import { formatTime } from '../utils/time-formatter';
import { createAudioFileService } from '../services/audio-file-service';
import { createTrackService } from '../services/track-service';
import { showLoadingIndicator, hideLoadingIndicator, showErrorNotification } from './components/loading';
import { AudioEngine } from '../core/audio-engine';
import { updateTrackWidth, centerViewOnTime } from '../utils/scroll-sync';
import { Effect } from '../models/effect';
import { createReverbEffect } from '../effects/reverb';
import { createDelayEffect } from '../effects/delay';

let selectedTrackId: string | null = null;

export function getSelectedTrackId(): string | null {
    return selectedTrackId;
}

export function setSelectedTrack(trackId: string | null): void {
    if (trackId === selectedTrackId) return;

    document.querySelectorAll('.track').forEach(el => {
        el.classList.remove('selected');
    });

    selectedTrackId = trackId;

    if (trackId) {
        const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
        if (trackElement) {
            trackElement.classList.add('selected');
        }
    }
}

export function setupEventHandlers(
    audioContext: AudioContext,
    masterGainNode: GainNode,
    audioEngine?: AudioEngine
): void {
    // TODO: Use Singleton Service
    const trackService = audioEngine ? audioEngine.trackService : createTrackService(audioContext, masterGainNode);
    const audioFileService = createAudioFileService(audioContext);

    let isPlaying = false;
    let currentPlaybackTime = 0;
    let startTime = 0;
    let pixelsPerSecond = 10;

    document.addEventListener('request:clip:buffer', (e: Event) => {
        const customEvent = e as CustomEvent;
        const { trackId, clipId, callback } = customEvent.detail;

        if (trackId && clipId && typeof callback === 'function') {
            const track = trackService.getAllTracks().find(t => t.id === trackId);
            if (track) {
                const clip = track.clips.find(c => c.id === clipId);
                if (clip) {
                    callback(clip.buffer);
                } else {
                    callback(null);
                }
            } else {
                callback(null);
            }
        }
    });

    // Elements
    const playButton = document.getElementById('play-button');
    const stopButton = document.getElementById('stop-button');
    const addTrackButton = document.getElementById('add-track-button');
    const currentTimeDisplay = document.getElementById('current-time');
    const exportButton = document.getElementById('export-button');
    const tracksContainer = document.getElementById('tracks-container');
    const timelineCursor = document.querySelector('.timeline-cursor');

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();

    // Listen for track deletion events
    document.addEventListener('track:delete', (e: Event) => {
        const customEvent = e as CustomEvent;
        const { trackId } = customEvent.detail;

        if (trackId) {
            removeTrack(trackId);
        }
    });

    // Listen for clip copy events
    document.addEventListener('clip:copy', () => {
        copySelectedClip();
    });

    // Listen for clip paste events
    document.addEventListener('clip:paste', () => {
        pasteClipToSelectedTrack();
    });

    // Listen for project loading events
    document.addEventListener('project:loaded', (e: Event) => {
        const customEvent = e as CustomEvent;
        const { name, fileName } = customEvent.detail;

        console.log(`Project loaded: ${name}${fileName ? ` (from file: ${fileName})` : ''}`);

        // Remove all existing tracks from the UI
        const tracksContainer = document.getElementById('tracks-container');
        if (tracksContainer) {
            console.log('Clearing tracks container');
            tracksContainer.innerHTML = '';
        } else {
            console.error('Tracks container not found when loading project');
        }

        // Add UI for all tracks in the trackService
        const tracks = trackService.getAllTracks();
        console.log(`Adding UI for ${tracks.length} tracks`);

        tracks.forEach(track => {
            console.log(`Adding UI for track ${track.id} with ${track.clips.length} clips and ${track.effects.length} effects`);
            addTrackToUI(track);

            // Verify clip elements were added
            const trackElement = document.querySelector(`[data-track-id="${track.id}"]`);
            if (trackElement) {
                const clipElements = trackElement.querySelectorAll('.audio-clip');
                console.log(`Track ${track.id} now has ${clipElements.length} clip elements in the UI`);

                // Update effects button state
                const effectsButton = trackElement.querySelector('.effects-button');
                if (effectsButton && track.effects.length > 0) {
                    const hasActiveEffects = track.effects.some(effect => !effect.bypass);
                    if (hasActiveEffects) {
                        effectsButton.classList.add('active');
                        console.log(`Track ${track.id} has active effects - highlighting effects button`);
                    }
                }
            }
        });

        // Update track width to accommodate the new clips
        updateTrackWidth();

        // Show notification
        const notification = document.createElement('div');
        notification.className = 'toast-notification';
        notification.textContent = `Project "${name}" loaded${fileName ? ' from existing file' : ''}`;
        document.body.appendChild(notification);

        // Show and then hide the notification
        setTimeout(() => {
            notification.classList.add('visible');
            setTimeout(() => {
                notification.classList.remove('visible');
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300); // Wait for fade-out animation
            }, 1500); // Show for 1.5 seconds
        }, 10);
    });

    // Listen for clip trim events
    document.addEventListener('clip:trim', (e: Event) => {
        const customEvent = e as CustomEvent;
        const { trackId, clipId, startTime, duration, offset } = customEvent.detail;

        console.log(`Trim event: Track ${trackId}, Clip ${clipId}`);
        console.log(`New values: startTime=${startTime}, duration=${duration}, offset=${offset}`);

        // Check if audio is currently playing
        const isPlaying = audioEngine?.isPlaying || false;
        let currentPlaybackTime = 0;

        // If audio is playing, remember the current position
        if (isPlaying && audioEngine) {
            currentPlaybackTime = audioEngine.currentTime;
            console.log(`Audio is currently playing at position ${currentPlaybackTime}s, will restart after trim`);
        }

        // Update the clip in the track service
        const track = trackService.getAllTracks().find(t => t.id === trackId);
        if (track) {
            const clip = track.clips.find(c => c.id === clipId);
            if (clip) {
                // Update the clip properties
                clip.startTime = startTime;
                clip.duration = duration;
                clip.offset = offset;

                console.log(`Updated clip ${clipId} in track ${trackId}: startTime=${startTime}, duration=${duration}, offset=${offset}`);

                // If audio was playing, restart it to reflect the new trim
                if (isPlaying && audioEngine) {
                    // Restart playback from where we left off
                    audioEngine.stopPlayback();
                    audioEngine.seekTo(currentPlaybackTime);
                    audioEngine.startPlayback();
                    console.log(`Restarted playback at position ${currentPlaybackTime}s after trimming clip`);
                }

                // Create toast notification
                const notification = document.createElement('div');
                notification.className = 'toast-notification';
                notification.textContent = 'Clip trimmed';
                document.body.appendChild(notification);

                // Show and then hide the notification
                setTimeout(() => {
                    notification.classList.add('visible');
                    setTimeout(() => {
                        notification.classList.remove('visible');
                        setTimeout(() => {
                            document.body.removeChild(notification);
                        }, 300); // Wait for fade-out animation
                    }, 1500); // Show for 1.5 seconds
                }, 10);
            }
        }
    });

    // Transport controls - only apply these if we don't have a reference to the AudioEngine
    // (otherwise, they're handled by transport.ts)
    if (!audioEngine) {
        if (playButton) {
            playButton.addEventListener('click', () => {
                if (!isPlaying) {
                    isPlaying = true;
                    startTime = audioContext.currentTime - currentPlaybackTime;
                    updateTimer();
                }
            });
        }

        if (stopButton) {
            stopButton.addEventListener('click', () => {
                if (isPlaying) {
                    isPlaying = false;
                }
                currentPlaybackTime = 0;
                updateTimeDisplay();
                updateCursorPosition();
            });
        }
    }

    // Add track button
    if (addTrackButton) {
        addTrackButton.addEventListener('click', () => {
            // Deselect all existing tracks
            document.querySelectorAll('.track').forEach(el => {
                el.classList.remove('selected');
            });

            // Add new track and select it
            const track = trackService.addTrack();
            selectedTrackId = track.id; // Set as selected track
            addTrackToUI(track);
        });
    }

    // Export button
    if (exportButton) {
        exportButton.addEventListener('click', async () => {
            // Export functionality would be added here
            console.log('Export clicked');
        });
    }

    // Handle import event from the dialog
    document.addEventListener('audio:import', (e: Event) => {
        const customEvent = e as CustomEvent;
        const { trackId, files } = customEvent.detail;

        if (files && files.length > 0 && trackId) {
            handleImportedFiles(files, trackId);
        }
    });

    // Function to handle imported files
    async function handleImportedFiles(files: File[], trackId: string) {
        // Show loading indicator message
        showLoadingIndicator("Importing audio files...");

        try {
            // Process each file in sequence
            for (const file of files) {
                try {
                    const audioBuffer = await audioFileService.loadAudioFile(file);

                    // Add clip to end of current content
                    const clips = trackService.getTrackClips(trackId);
                    let startTime = 0;

                    if (clips && clips.length > 0) {
                        // Calculate the end time of the last clip
                        const lastClip = clips.reduce((latest, clip) => {
                            const clipEndTime = clip.startTime + clip.duration;
                            return clipEndTime > latest.endTime
                                ? { endTime: clipEndTime }
                                : latest;
                        }, { endTime: 0 });

                        startTime = lastClip.endTime + 0.5; // Add a small gap
                    }

                    const clip: AudioClip = {
                        id: crypto.randomUUID(),
                        buffer: audioBuffer,
                        startTime,
                        duration: audioBuffer.duration,
                        offset: 0,
                        name: file.name
                    };

                    addClipToTrack(trackId, clip);

                    // Update track width to accommodate the new clip
                    updateTrackWidth();

                    // Center view on the new clip
                    centerViewOnTime(clip.startTime + (clip.duration / 2), pixelsPerSecond);
                } catch (error) {
                    console.error(`Error loading audio file ${file.name}:`, error);
                    showErrorNotification(`Failed to load "${file.name}": ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        } finally {
            hideLoadingIndicator();
        }
    }

    // Update timer function
    function updateTimer() {
        if (!isPlaying) return;

        currentPlaybackTime = audioContext.currentTime - startTime;
        updateTimeDisplay();
        updateCursorPosition();

        requestAnimationFrame(updateTimer);
    }

    function updateTimeDisplay() {
        if (currentTimeDisplay) {
            currentTimeDisplay.textContent = formatTime(currentPlaybackTime);
        }
    }

    function updateCursorPosition() {
        if (timelineCursor) {
            const position = currentPlaybackTime * pixelsPerSecond;
            (timelineCursor as HTMLElement).style.left = `${position}px`;
        }
    }

    // Add a track to the UI
    function addTrackToUI(track: AudioTrack) {
        if (!tracksContainer) return;

        console.log(`Adding track to UI: ${track.id}, clips: ${track.clips.length}`);

        // Debug log clip info
        if (track.clips.length > 0) {
            track.clips.forEach(clip => {
                console.log(`Clip in track: ${clip.id}, name: ${clip.name}, buffer: ${clip.buffer ? 'present' : 'missing'}`);
            });
        }

        const trackElement = document.createElement('div');
        trackElement.classList.add('track');
        trackElement.dataset.trackId = track.id;

        // If no track is selected yet, select this one as default
        if (selectedTrackId === null) {
            selectedTrackId = track.id;
            trackElement.classList.add('selected');
        }

        // Create a track name using "Track X" format
        const trackCount = document.querySelectorAll('.track').length + 1;
        const trackName = `Track ${trackCount}`;

        trackElement.innerHTML = `
      <div class="track-header">
        <div class="track-controls">
          <button class="mute-button" title="Mute">M</button>
          <button class="solo-button" title="Solo">S</button>
          <button class="effects-button" title="Effects">FX</button>
          <div class="track-name" title="${trackName}">${trackName}</div>
          <button class="delete-track-btn" title="Delete Track">✕</button>
        </div>
        <div class="track-fader">
          <span class="volume-label">Volume</span>
          <input type="range" min="0" max="1" step="0.01" value="1" class="gain-slider" title="Volume">
          <span class="volume-display">100%</span>
        </div>
      </div>
      <div class="track-clips"></div>
    `;

        // Add click event to select this track
        trackElement.addEventListener('click', (e) => {
            // Don't trigger track selection if clicking on a button or slider
            const target = e.target as HTMLElement;
            if (
                target.classList.contains('mute-button') ||
                target.classList.contains('solo-button') ||
                target.classList.contains('effects-button') ||
                target.classList.contains('delete-track-btn') ||
                target.tagName === 'INPUT'
            ) {
                return;
            }

            // Deselect all tracks
            document.querySelectorAll('.track').forEach(el => {
                el.classList.remove('selected');
            });

            // Select this track
            trackElement.classList.add('selected');
            selectedTrackId = track.id;

            console.log(`Selected track: ${track.id}`);
        });

        tracksContainer.appendChild(trackElement);

        // Add any existing clips from the track model to the UI
        if (track.clips.length > 0) {
            console.log(`Adding ${track.clips.length} clips to track ${track.id}`);
            const clipContainer = trackElement.querySelector('.track-clips');

            if (clipContainer) {
                track.clips.forEach(clip => {
                    if (clip.buffer) {
                        console.log(`Creating UI element for clip ${clip.id} (${clip.name})`);
                        const clipElement = createClipElement(clip, pixelsPerSecond);
                        clipContainer.appendChild(clipElement);

                        // Setup all event handlers for the clip
                        setupClipEventListeners(clipElement, clip, track.id);

                        console.log(`Added clip element for ${clip.id} to the DOM`);
                    } else {
                        console.warn(`Clip ${clip.id} has no buffer, skipping UI creation`);
                    }
                });
            } else {
                console.warn(`No clip container found in track ${track.id}`);
            }
        }

        // Add event listeners for track controls
        // Set up mute button with track service integration
        const muteButton = trackElement.querySelector('.mute-button');
        if (muteButton) {
            muteButton.addEventListener('click', () => {
                // Use track service to handle muting (which also updates audio graph)
                const isMuted = trackService.toggleMute(track.id);
                // Update UI to reflect the mute state
                muteButton.classList.toggle('active', isMuted);
                // Add or remove the muted class on the track for visual effects
                trackElement.classList.toggle('muted', isMuted);
                // Add visual feedback
                muteButton.setAttribute('title', isMuted ? 'Unmute' : 'Mute');
            });
        }

        // Set up solo button with track service integration
        const soloButton = trackElement.querySelector('.solo-button');
        if (soloButton) {
            soloButton.addEventListener('click', () => {
                // Use track service to handle soloing (which also updates audio graph)
                const isSolo = trackService.toggleSolo(track.id);

                // Update UI to reflect the solo state
                soloButton.classList.toggle('active', isSolo);

                // Add visual feedback
                soloButton.setAttribute('title', isSolo ? 'Unsolo' : 'Solo');

                // Check if any tracks are soloed
                const hasSoloTracks = trackService.getAllTracks().some(t => t.solo);

                // Update all track visual states based on solo status
                if (hasSoloTracks) {
                    // Apply visual muted effect to all non-soloed tracks
                    document.querySelectorAll('.track').forEach(trackEl => {
                        const trackId = trackEl.getAttribute('data-track-id');
                        if (trackId) {
                            const trackData = trackService.getAllTracks().find(t => t.id === trackId);
                            if (trackData) {
                                // Add muted class to tracks that are not soloed (for visual effect)
                                trackEl.classList.toggle('muted', !trackData.solo);
                            }
                        }
                    });
                } else {
                    // No solo tracks, revert to normal mute status
                    document.querySelectorAll('.track').forEach(trackEl => {
                        const trackId = trackEl.getAttribute('data-track-id');
                        if (trackId) {
                            const trackData = trackService.getAllTracks().find(t => t.id === trackId);
                            if (trackData) {
                                // Base muted visual state on track's mute status only
                                trackEl.classList.toggle('muted', trackData.muted);
                            }
                        }
                    });
                }
            });
        }

        // Set up delete track button
        const deleteTrackButton = trackElement.querySelector('.delete-track-btn');
        if (deleteTrackButton) {
            deleteTrackButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling to avoid track selection
                removeTrack(track.id);
            });
        }

        // Set up volume slider with visual feedback and dynamic control
        const gainSlider = trackElement.querySelector('.gain-slider') as HTMLInputElement;
        const volumeDisplay = trackElement.querySelector('.volume-display') as HTMLElement;

        if (gainSlider && volumeDisplay) {
            // Initial volume display value
            const initialVolume = Math.round(track.gainValue * 100);
            volumeDisplay.textContent = `${initialVolume}%`;

            // Update volume display and set actual audio volume when slider changes
            gainSlider.addEventListener('input', () => {
                const volume = parseFloat(gainSlider.value);

                // Update the track's volume in the audio engine
                trackService.setTrackVolume(track.id, volume);

                // Update the volume display with percentage
                const volumePercent = Math.round(volume * 100);
                volumeDisplay.textContent = `${volumePercent}%`;

                // Change color based on volume level
                if (volumePercent > 90) {
                    volumeDisplay.style.color = '#e74c3c'; // Red for high volumes
                } else if (volumePercent > 70) {
                    volumeDisplay.style.color = '#f39c12'; // Orange for medium-high volumes
                } else {
                    volumeDisplay.style.color = '#fff'; // White for normal volumes
                }
            });

            // Show volume on hover or when interacting
            gainSlider.addEventListener('mouseover', () => {
                volumeDisplay.style.opacity = '1';
            });

            gainSlider.addEventListener('focus', () => {
                volumeDisplay.style.opacity = '1';
            });

            // Hide volume when mouse leaves or interaction ends
            gainSlider.addEventListener('mouseleave', () => {
                if (document.activeElement !== gainSlider) {
                    // Small delay before hiding
                    setTimeout(() => {
                        volumeDisplay.style.opacity = '0';
                    }, 500);
                }
            });

            gainSlider.addEventListener('blur', () => {
                // Small delay before hiding
                setTimeout(() => {
                    if (!gainSlider.matches(':hover')) {
                        volumeDisplay.style.opacity = '0';
                    }
                }, 500);
            });
        }

        // Set up drag and drop for this track's clip area
        setupTrackDropZone(trackElement.querySelector('.track-clips'));

        // Set up effects panel
        setupEffectsPanel(trackElement, track);
    }

    // Function to set up the effects button for a track
    function setupEffectsPanel(trackElement: HTMLElement, track: AudioTrack): void {
        const effectsButton = trackElement.querySelector('.effects-button') as HTMLElement;

        if (!effectsButton) {
            console.warn('Effects button not found');
            return;
        }

        // Highlight effects button if track has effects
        if (track.effects && track.effects.length > 0) {
            const hasActiveEffects = track.effects.some(effect => !effect.bypass);
            effectsButton.classList.toggle('active', hasActiveEffects);
        }

        // Set up effects button click event
        effectsButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent track selection

            if (!track || !audioEngine) return;

            // Show effects manager modal
            showEffectsManagerModal(track);
        });
    }

    // Show effects manager modal for a track
    function showEffectsManagerModal(track: AudioTrack): void {
        // Create modal dialog
        const dialog = document.createElement('div');
        dialog.className = 'modal-dialog';
        dialog.innerHTML = `
      <div class="modal-content effects-manager">
        <div class="modal-header">
          <h2>Track Effects</h2>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <div class="effects-actions">
            <button class="add-effect-btn primary-button">Add Effect</button>
          </div>
          <div class="effects-list"></div>
        </div>
      </div>
    `;

        document.body.appendChild(dialog);

        // Show dialog with animation
        setTimeout(() => {
            dialog.classList.add('visible');
        }, 10);

        // Close button functionality
        const closeButton = dialog.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                dialog.classList.remove('visible');
                setTimeout(() => {
                    document.body.removeChild(dialog);
                }, 300);
            });
        }

        // Set up add effect button
        const addEffectBtn = dialog.querySelector('.add-effect-btn');
        if (addEffectBtn) {
            addEffectBtn.addEventListener('click', () => {
                showEffectSelectionDialog(track.id, dialog);
            });
        }

        // Populate effects list
        const effectsList = dialog.querySelector('.effects-list');
        if (effectsList && track.effects.length > 0) {
            track.effects.forEach(effect => {
                addEffectToUI(effect, effectsList as HTMLElement, track);
            });
        } else if (effectsList) {
            effectsList.innerHTML = '<div class="no-effects-message">No effects added to this track yet.</div>';
        }
    }

    // Show dialog for selecting which effect to add
    function showEffectSelectionDialog(trackId: string, parentDialog?: HTMLElement): void {
        const dialog = document.createElement('div');
        dialog.className = 'modal-dialog effect-selection-dialog';
        dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add Effect</h2>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <div class="effect-selection">
            <div class="effect-option" data-effect="reverb">
              <div class="effect-icon">🔊</div>
              <div class="effect-info">
                <h3>Reverb</h3>
                <p>Add space and ambience to your audio</p>
              </div>
            </div>
            <div class="effect-option" data-effect="delay">
              <div class="effect-icon">🔄</div>
              <div class="effect-info">
                <h3>Delay</h3>
                <p>Create echo and repeat effects</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

        document.body.appendChild(dialog);

        // Show dialog
        setTimeout(() => {
            dialog.classList.add('visible');
        }, 10);

        // Close dialog when X is clicked
        const closeButton = dialog.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                dialog.classList.remove('visible');
                setTimeout(() => {
                    document.body.removeChild(dialog);
                }, 300);
            });
        }

        // Handle effect selection
        const effectOptions = dialog.querySelectorAll('.effect-option');
        effectOptions.forEach(option => {
            option.addEventListener('click', () => {
                const effectType = option.getAttribute('data-effect');
                if (effectType && audioEngine) {
                    // Add the selected effect to the track
                    let effect: Effect | null = null;

                    if (effectType === 'reverb') {
                        // Add reverb effect
                        effect = createReverbEffect(audioEngine.audioContext);
                    } else if (effectType === 'delay') {
                        // Add delay effect
                        effect = createDelayEffect(audioEngine.audioContext);
                    }

                    if (effect) {
                        console.log(`Adding ${effectType} effect to track ${trackId}`);
                        audioEngine.trackService.addEffectToTrack(trackId, effect);

                        // Get the track for UI updates
                        const track = audioEngine.trackService.getAllTracks().find(t => t.id === trackId);

                        // Update track element to show effects status
                        const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
                        if (trackElement) {
                            const effectsButton = trackElement.querySelector('.effects-button');
                            if (effectsButton) {
                                effectsButton.classList.add('active');
                            }
                        }

                        // If we have a parent dialog (effects manager), update it with the new effect
                        if (parentDialog && track) {
                            const effectsList = parentDialog.querySelector('.effects-list');
                            if (effectsList) {
                                // Clear 'no effects' message if it exists
                                if (effectsList.querySelector('.no-effects-message')) {
                                    effectsList.innerHTML = '';
                                }

                                // Add the new effect to the UI
                                addEffectToUI(effect, effectsList as HTMLElement, track);
                            }
                        }

                        // Create notification
                        const notification = document.createElement('div');
                        notification.className = 'toast-notification';
                        notification.textContent = `Added ${effectType} effect`;
                        document.body.appendChild(notification);

                        // Show and then hide notification
                        setTimeout(() => {
                            notification.classList.add('visible');
                            setTimeout(() => {
                                notification.classList.remove('visible');
                                setTimeout(() => {
                                    document.body.removeChild(notification);
                                }, 300);
                            }, 1500);
                        }, 10);
                    }
                }

                // Close the dialog
                dialog.classList.remove('visible');
                setTimeout(() => {
                    document.body.removeChild(dialog);
                }, 300);
            });
        });
    }

    // Add effect to the UI
    function addEffectToUI(effect: Effect, container: HTMLElement, track: AudioTrack): void {
        // Create container for the effect
        const effectElement = document.createElement('div');
        effectElement.className = `effect-item ${effect.bypass ? 'effect-bypass' : ''}`;
        effectElement.dataset.effectId = effect.id;

        // Create effect header with title and controls
        const effectHeader = document.createElement('div');
        effectHeader.className = 'effect-header';

        // Create effect title
        const effectTitle = document.createElement('div');
        effectTitle.className = 'effect-title';
        effectTitle.textContent = effect.type.charAt(0).toUpperCase() + effect.type.slice(1);

        // Create effect controls
        const effectControls = document.createElement('div');
        effectControls.className = 'effect-controls';

        // Create bypass button
        const bypassButton = document.createElement('button');
        bypassButton.className = `effect-control-btn bypass-btn ${effect.bypass ? 'active' : ''}`;
        bypassButton.title = effect.bypass ? 'Enable' : 'Bypass';
        bypassButton.textContent = effect.bypass ? '⊘' : '⦿';

        // Create remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'effect-control-btn remove-btn';
        removeButton.title = 'Remove';
        removeButton.textContent = '×';

        // Add controls to header
        effectControls.appendChild(bypassButton);
        effectControls.appendChild(removeButton);
        effectHeader.appendChild(effectTitle);
        effectHeader.appendChild(effectControls);

        // Create parameters container
        const paramsContainer = document.createElement('div');
        paramsContainer.className = 'effect-parameters';

        // Add parameters
        effect.parameters.forEach(param => {
            // Parameter name
            const paramName = document.createElement('div');
            paramName.className = 'param-name';
            paramName.textContent = param.name;

            // Parameter slider
            const paramSlider = document.createElement('input');
            paramSlider.type = 'range';
            paramSlider.className = 'param-slider';
            paramSlider.min = param.min.toString();
            paramSlider.max = param.max.toString();
            paramSlider.step = param.step.toString();
            paramSlider.value = param.value.toString();

            // Parameter value display
            const paramValue = document.createElement('div');
            paramValue.className = 'param-value';
            paramValue.textContent = param.value.toFixed(2);

            // Add parameter elements to container
            paramsContainer.appendChild(paramName);
            paramsContainer.appendChild(paramSlider);
            paramsContainer.appendChild(paramValue);

            // Add event listener for slider changes
            paramSlider.addEventListener('input', () => {
                const newValue = parseFloat(paramSlider.value);
                paramValue.textContent = newValue.toFixed(2);

                // Update the parameter in the effect
                if (audioEngine) {
                    audioEngine.trackService.updateEffectParameter(track.id, effect.id, param.name, newValue);
                }
            });
        });

        // Add header and parameters to effect
        effectElement.appendChild(effectHeader);
        effectElement.appendChild(paramsContainer);

        // Add event listeners for controls
        bypassButton.addEventListener('click', () => {
            if (audioEngine) {
                const isBypassed = audioEngine.trackService.toggleEffectBypass(track.id, effect.id);

                // Update UI
                bypassButton.textContent = isBypassed ? '⊘' : '⦿';
                bypassButton.title = isBypassed ? 'Enable' : 'Bypass';
                effectElement.classList.toggle('effect-bypass', isBypassed);
                bypassButton.classList.toggle('active', isBypassed);

                // Update the effects button on the track
                const trackElement = document.querySelector(`[data-track-id="${track.id}"]`);
                if (trackElement) {
                    const effectsButton = trackElement.querySelector('.effects-button');
                    if (effectsButton) {
                        // Check if any effects are active (not bypassed)
                        const hasActiveEffects = track.effects.some(e => !e.bypass);
                        effectsButton.classList.toggle('active', hasActiveEffects);
                    }
                }
            }
        });

        removeButton.addEventListener('click', () => {
            if (audioEngine) {
                // Remove effect from the track
                audioEngine.trackService.removeEffectFromTrack(track.id, effect.id);

                // Remove from UI with animation
                effectElement.style.height = effectElement.offsetHeight + 'px';
                effectElement.classList.add('removing');

                // Set height to 0 to animate collapse
                setTimeout(() => {
                    effectElement.style.height = '0';
                    effectElement.style.opacity = '0';
                    effectElement.style.padding = '0';
                    effectElement.style.margin = '0';
                    effectElement.style.overflow = 'hidden';

                    // Remove element after animation completes
                    setTimeout(() => {
                        if (effectElement.parentElement) {
                            effectElement.parentElement.removeChild(effectElement);

                            // Check if this was the last effect
                            if (container.querySelectorAll('.effect-item').length === 0) {
                                container.innerHTML = '<div class="no-effects-message">No effects added to this track yet.</div>';
                            }
                        }

                        // Update the effects button on the track
                        const trackElement = document.querySelector(`[data-track-id="${track.id}"]`);
                        if (trackElement && audioEngine) {
                            const effectsButton = trackElement.querySelector('.effects-button');
                            if (effectsButton) {
                                // Get updated track data
                                const updatedTrack = audioEngine.trackService.getAllTracks().find(t => t.id === track.id);
                                if (updatedTrack) {
                                    // Check if any effects are active
                                    const hasActiveEffects = updatedTrack.effects.some(e => !e.bypass);
                                    effectsButton.classList.toggle('active', hasActiveEffects && updatedTrack.effects.length > 0);
                                } else {
                                    effectsButton.classList.remove('active');
                                }
                            }
                        }
                    }, 300);
                }, 10);

                // Show notification
                const notification = document.createElement('div');
                notification.className = 'toast-notification';
                notification.textContent = `Removed ${effect.type} effect`;
                document.body.appendChild(notification);

                // Show and then hide notification
                setTimeout(() => {
                    notification.classList.add('visible');
                    setTimeout(() => {
                        notification.classList.remove('visible');
                        setTimeout(() => {
                            document.body.removeChild(notification);
                        }, 300);
                    }, 1500);
                }, 10);
            }
        });

        // Add effect to container
        container.appendChild(effectElement);
    }

    // Global variables to track selection and clipboard
    let selectedClipId: string | null = null;
    let clipboardData: {
        clipId: string;
        trackId: string;
        startTime: number;
        duration: number;
        audioBuffer: AudioBuffer | null;
        name: string;
    } | null = null;

    // Handle clip drop for moving between tracks
    function handleClipDrop(dragEvent: DragEvent, dropZone: Element, transferData: { clipId: string, trackId: string }) {
        const { clipId, trackId: sourceTrackId } = transferData;

        console.log(`Processing clip drop: clipId=${clipId}, sourceTrackId=${sourceTrackId}`);

        // Get the target track ID
        const targetTrackElement = dropZone.closest('.track');
        if (!targetTrackElement) {
            console.warn('No target track element found for clip drop');
            return;
        }

        const targetTrackId = targetTrackElement.getAttribute('data-track-id');
        if (!targetTrackId) {
            console.warn('No target track ID found for clip drop');
            return;
        }

        // If source and target tracks are the same, this is just a repositioning, not a track change
        if (sourceTrackId === targetTrackId) {
            console.log('Clip dropped on the same track - not moving between tracks');
            return;
        }

        // Validate that both source and target tracks exist
        const allTracks = trackService.getAllTracks();
        const sourceTrackExists = allTracks.some(t => t.id === sourceTrackId);
        const targetTrackExists = allTracks.some(t => t.id === targetTrackId);

        if (!sourceTrackExists) {
            console.warn(`Source track ${sourceTrackId} does not exist`);
            return;
        }

        if (!targetTrackExists) {
            console.warn(`Target track ${targetTrackId} does not exist`);
            return;
        }

        // Check if audio is currently playing
        const isPlaying = audioEngine?.isPlaying || false;
        let currentPlaybackTime = 0;

        // If audio is playing, remember the current position
        if (isPlaying && audioEngine) {
            currentPlaybackTime = audioEngine.currentTime;
            console.log(`Audio is currently playing at position ${currentPlaybackTime}s, will restart after move`);
        }

        console.log(`Moving clip ${clipId} from track ${sourceTrackId} to track ${targetTrackId}`);

        // Calculate the new position based on drop coordinates
        const rect = dropZone.getBoundingClientRect();
        const dropX = dragEvent.clientX - rect.left;
        const newStartTime = Math.max(0, dropX / pixelsPerSecond);

        // 1. Find the original clip element - using a more specific selector for better reliability
        const sourceClipElement = document.querySelector(`.track[data-track-id="${sourceTrackId}"] [data-clip-id="${clipId}"]`);
        if (!sourceClipElement) {
            console.warn(`Source clip element not found with trackId=${sourceTrackId} and clipId=${clipId}`);

            // Fallback to a less specific selector
            const fallbackElement = document.querySelector(`[data-clip-id="${clipId}"]`);
            if (fallbackElement) {
                console.log('Found clip element with fallback selector');
            } else {
                console.error('Could not find clip element even with fallback selector');
                return;
            }
        }

        // Get the clip data from the source track
        const sourceTrack = trackService.getAllTracks().find(t => t.id === sourceTrackId);
        if (!sourceTrack) {
            console.warn('Source track not found in trackService');
            return;
        }

        const sourceClip = sourceTrack.clips.find(c => c.id === clipId);
        if (!sourceClip) {
            console.warn('Source clip not found in track data');
            return;
        }

        // 2. Move the clip in the data model
        const movedClip = trackService.moveClipToTrack(sourceTrackId, targetTrackId, clipId, newStartTime);

        if (!movedClip) {
            console.error('Failed to move clip between tracks');
            return;
        }

        // 3. Find and remove the clip from the source track's UI
        const sourceClipElements = document.querySelectorAll(`[data-clip-id="${clipId}"]`);
        sourceClipElements.forEach(element => {
            // Remove all instances to avoid duplicates
            element.remove();
        });

        // 4. Add the clip to the target track's UI
        const targetClipContainer = targetTrackElement.querySelector('.track-clips');
        if (!targetClipContainer) {
            console.warn('Target clip container not found');
            return;
        }

        // Create a new clip element for the target track
        const newClipElement = createClipElement(movedClip, pixelsPerSecond);
        targetClipContainer.appendChild(newClipElement);

        // Setup all event handlers for the new clip element
        setupClipEventListeners(newClipElement, movedClip, targetTrackId);

        // Mark this as moved for debugging
        newClipElement.setAttribute('data-was-moved', 'true');

        // Ensure draggable is set to true
        newClipElement.draggable = true;

        // Extra debug check
        console.log("New clip element draggable status:", newClipElement.draggable);

        // Visual feedback
        newClipElement.classList.add('moved');
        setTimeout(() => {
            newClipElement.classList.remove('moved');
        }, 500);

        // If audio was playing, restart it to reflect the new arrangement
        if (isPlaying && audioEngine) {
            // Restart playback from where we left off
            audioEngine.stopPlayback();
            audioEngine.seekTo(currentPlaybackTime);
            audioEngine.startPlayback();
            console.log(`Restarted playback at position ${currentPlaybackTime}s after moving clip`);
        }

        // Show toast notification
        const notification = document.createElement('div');
        notification.className = 'toast-notification';
        notification.textContent = 'Clip moved to another track';
        document.body.appendChild(notification);

        // Show and then hide the notification
        setTimeout(() => {
            notification.classList.add('visible');
            setTimeout(() => {
                notification.classList.remove('visible');
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300); // Wait for fade-out animation
            }, 1500); // Show for 1.5 seconds
        }, 10);
    }

    // Function to remove a track
    function removeTrack(trackId: string) {
        console.log(`Removing track ${trackId}`);

        // First check if this track has clips
        const track = trackService.getAllTracks().find(t => t.id === trackId);
        const hasClips = track && track.clips.length > 0;

        // If the track has clips, confirm before deleting
        if (hasClips) {
            if (!confirm(`This track contains ${track?.clips.length} clip(s). Are you sure you want to delete it?`)) {
                console.log('Track deletion cancelled by user');
                return;
            }
        }

        // Remove from the track service data model
        trackService.removeTrack(trackId);

        // Remove from the UI
        const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
        if (trackElement) {
            trackElement.remove();
        }

        // Clear track selection if this was the selected track
        if (selectedTrackId === trackId) {
            selectedTrackId = null;

            // Automatically select another track if available
            const firstTrack = document.querySelector('.track');
            if (firstTrack) {
                firstTrack.classList.add('selected');
                selectedTrackId = firstTrack.getAttribute('data-track-id');
            }
        }

        // Update the UI
        updateTrackWidth();
    }

    // Function to remove a clip
    function removeClip(trackId: string, clipId: string) {
        console.log(`Removing clip ${clipId} from track ${trackId}`);

        function showNotification(message: string, isError: boolean = false): void {
            const notification = document.createElement('div');
            notification.className = 'toast-notification';
            if (isError) {
                notification.style.backgroundColor = 'rgba(231, 76, 60, 0.9)'; // Red for error
            }
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.classList.add('visible');
                setTimeout(() => {
                    notification.classList.remove('visible');
                    setTimeout(() => {
                        document.body.removeChild(notification);
                    }, 300);
                }, 1500);
            }, 10);
        }

        // First let's determine the correct track for this clip
        let correctTrackId = trackId;
        let clipFound = false;
        let clipToRemove: AudioClip | undefined;

        // Check if the clip is in the specified track
        const track = trackService.getAllTracks().find(t => t.id === trackId);
        if (track) {
            clipToRemove = track.clips.find(c => c.id === clipId);
            if (clipToRemove) {
                clipFound = true;
            }
        } else {
            console.error(`Track ${trackId} not found`);
        }

        // If clip not found in the specified track, search all tracks
        if (!clipFound) {
            console.warn(`Clip ${clipId} not found in track ${trackId}, searching other tracks...`);

            trackService.getAllTracks().forEach(t => {
                const clip = t.clips.find(c => c.id === clipId);
                if (clip) {
                    console.log(`Found clip ${clipId} in track ${t.id} instead`);
                    correctTrackId = t.id;
                    clipToRemove = clip;
                    clipFound = true;
                }
            });
        }

        if (!clipFound) {
            console.error(`Clip ${clipId} not found in any track`);
            showNotification('Could not find the clip to delete', true);
            return;
        }

        try {
            // Remove from the track service data model
            trackService.removeClipFromTrack(correctTrackId, clipId);
            console.log(`Removed clip ${clipId} from track data model (track: ${correctTrackId})`);

            // Remove from the UI - try both specific and general selector
            let clipElement = document.querySelector(`.track[data-track-id="${correctTrackId}"] [data-clip-id="${clipId}"]`);
            if (!clipElement) {
                // Try more general selector if specific one failed
                clipElement = document.querySelector(`[data-clip-id="${clipId}"]`);
            }

            if (clipElement) {
                // Add a visual effect before removing the element
                clipElement.classList.add('deleting');

                // Remove after a brief delay for the effect to be visible
                setTimeout(() => {
                    clipElement?.remove();
                    console.log(`Removed clip ${clipId} from UI`);
                }, 100);
            } else {
                console.warn(`Could not find clip element in DOM: ${clipId}`);
            }

            // Clear selection if this was the selected clip
            if (selectedClipId === clipId) {
                selectedClipId = null;
                console.log(`Cleared selected clip ID (was ${clipId})`);
            }

            // Show success notification
            showNotification('Clip deleted');

            // Verify the clip was actually removed from the data model
            const updatedTrack = trackService.getAllTracks().find(t => t.id === correctTrackId);
            const clipStillExists = updatedTrack?.clips.some(c => c.id === clipId);

            if (clipStillExists) {
                console.error(`Failed to remove clip ${clipId} from track data model`);
                showNotification('Error: Clip may not have been fully removed', true);
            }

            // Update the track width after removing a clip
            updateTrackWidth();
        } catch (error) {
            console.error(`Error removing clip ${clipId}:`, error);
            showNotification(`Error removing clip: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
        }
    }

    // Function to copy the selected clip
    function copySelectedClip(): boolean {
        if (!selectedClipId) {
            console.log('No clip selected to copy');

            // Show a notification to the user
            const notification = document.createElement('div');
            notification.className = 'toast-notification';
            notification.style.backgroundColor = 'rgba(255, 165, 0, 0.9)'; // Orange for warning
            notification.textContent = 'Please select a clip to copy';
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.classList.add('visible');
                setTimeout(() => {
                    notification.classList.remove('visible');
                    setTimeout(() => {
                        document.body.removeChild(notification);
                    }, 300);
                }, 1500);
            }, 10);

            return false;
        }

        console.log(`Attempting to copy clip with ID: ${selectedClipId}`);

        // First check directly in the track service before looking for DOM elements
        let foundClip: AudioClip | null = null;
        let foundTrackId: string | null = null;

        // Search through all tracks and clips for the selected clip ID
        trackService.getAllTracks().forEach(track => {
            const clip = track.clips.find(c => c.id === selectedClipId);
            if (clip) {
                foundClip = clip;
                foundTrackId = track.id;
            }
        });

        // If found directly in the track service, use that
        if (foundClip && foundTrackId) {
            console.log(`Found clip ${selectedClipId} directly in track service (track: ${foundTrackId})`);

            // Explicit type guard to ensure foundClip is treated as AudioClip
            const audioClip: AudioClip = foundClip;

            if (!audioClip.buffer) {
                console.error('Cannot copy clip with missing audio buffer');

                // Show error notification
                const notification = document.createElement('div');
                notification.className = 'toast-notification';
                notification.style.backgroundColor = 'rgba(231, 76, 60, 0.9)'; // Red for error
                notification.textContent = 'Cannot copy clip with missing audio';
                document.body.appendChild(notification);

                setTimeout(() => {
                    notification.classList.add('visible');
                    setTimeout(() => {
                        notification.classList.remove('visible');
                        setTimeout(() => {
                            document.body.removeChild(notification);
                        }, 300);
                    }, 1500);
                }, 10);

                return false;
            }

            // Store clip data in clipboard
            clipboardData = {
                clipId: audioClip.id,
                trackId: foundTrackId,
                startTime: audioClip.startTime,
                duration: audioClip.duration,
                audioBuffer: audioClip.buffer,
                name: audioClip.name
            };

            console.log(`Copied clip "${audioClip.name}" to clipboard (from track service)`);

            // Try to find the DOM element for visual feedback
            const clipElement = document.querySelector(`[data-clip-id="${selectedClipId}"]`) as HTMLElement;
            if (clipElement) {
                // Visual feedback - flash effect
                clipElement.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.7)';
                clipElement.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    clipElement.style.boxShadow = '';
                    clipElement.style.transform = '';
                }, 300);
            }

            // Show toast notification
            const notification = document.createElement('div');
            notification.className = 'toast-notification';
            notification.textContent = 'Clip copied';
            document.body.appendChild(notification);

            // Show and then hide the notification
            setTimeout(() => {
                notification.classList.add('visible');
                setTimeout(() => {
                    notification.classList.remove('visible');
                    setTimeout(() => {
                        document.body.removeChild(notification);
                    }, 300); // Wait for fade-out animation
                }, 1500); // Show for 1.5 seconds
            }, 10);

            return true;
        }

        console.error(`Selected clip ${selectedClipId} not found in track service`);

        // Show error notification
        const notification = document.createElement('div');
        notification.className = 'toast-notification';
        notification.style.backgroundColor = 'rgba(231, 76, 60, 0.9)'; // Red for error
        notification.textContent = 'Selected clip not found';
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('visible');
            setTimeout(() => {
                notification.classList.remove('visible');
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }, 1500);
        }, 10);

        return false;
    }

    // Function to paste the copied clip to the selected track
    function pasteClipToSelectedTrack(): boolean {
        console.log('Attempting to paste clip from clipboard');

        function showNotification(message: string, isError: boolean = false): void {
            const notification = document.createElement('div');
            notification.className = 'toast-notification';
            if (isError) {
                notification.style.backgroundColor = 'rgba(231, 76, 60, 0.9)'; // Red for error
            } else if (message.includes('Please')) {
                notification.style.backgroundColor = 'rgba(255, 165, 0, 0.9)'; // Orange for warning
            }
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.classList.add('visible');
                setTimeout(() => {
                    notification.classList.remove('visible');
                    setTimeout(() => {
                        document.body.removeChild(notification);
                    }, 300);
                }, 1500);
            }, 10);
        }

        if (!clipboardData) {
            console.error('No clipboard data available');
            showNotification('Please copy a clip first', true);
            return false;
        }

        if (!clipboardData.audioBuffer) {
            console.error('Clipboard data has no audio buffer');
            showNotification('Cannot paste clip: missing audio data', true);
            return false;
        }

        if (!selectedTrackId) {
            console.error('No track selected for paste operation');
            showNotification('Please select a track to paste to', true);
            return false;
        }

        // Log details about the audio buffer being pasted
        console.log(`Pasting audio buffer: ${clipboardData.audioBuffer.duration}s, ${clipboardData.audioBuffer.numberOfChannels} channels`);

        // Verify the target track exists before attempting to add the clip
        const targetTrack = trackService.getAllTracks().find(t => t.id === selectedTrackId);
        if (!targetTrack) {
            console.error(`Target track ${selectedTrackId} not found in track service`);
            showNotification('Target track not found', true);
            return false;
        }

        console.log(`Found target track: ${targetTrack.id}, adding clip...`);

        try {
            // Create a new clip based on the clipboard data
            const newClip: AudioClip = {
                id: crypto.randomUUID(),
                buffer: clipboardData.audioBuffer,
                // Position it at cursor or slightly offset from the original
                startTime: clipboardData.startTime,
                duration: clipboardData.duration,
                offset: 0,
                name: `${clipboardData.name} (copy)`
            };

            console.log(`Created new clip: ${newClip.id}, name: ${newClip.name}, duration: ${newClip.duration}s`);

            // Add the clip to the selected track
            addClipToTrack(selectedTrackId, newClip);

            console.log(`Pasted clip "${newClip.name}" to track ${selectedTrackId}`);

            // Verify clip was added to the track model
            const updatedTrack = trackService.getAllTracks().find(t => t.id === selectedTrackId);
            const clipAddedToModel = updatedTrack?.clips.some(c => c.id === newClip.id);

            console.log(`Clip added to track model: ${clipAddedToModel ? 'yes' : 'no'}`);

            if (!clipAddedToModel) {
                console.error('Clip was not properly added to the track model');
                showNotification('Error adding clip to track', true);
                return false;
            }

            // Visual feedback for the track
            const trackElement = document.querySelector(`[data-track-id="${selectedTrackId}"]`);
            if (trackElement) {
                trackElement.classList.add('paste-highlight');
                setTimeout(() => {
                    trackElement.classList.remove('paste-highlight');
                }, 300);

                // Check for clip element in the DOM
                setTimeout(() => {
                    const clipElement = trackElement.querySelector(`[data-clip-id="${newClip.id}"]`);
                    console.log(`Clip element added to DOM: ${clipElement ? 'yes' : 'no'}`);

                    if (clipElement) {
                        // Extra visual feedback on the newly created clip
                        clipElement.classList.add('pasted');
                        setTimeout(() => {
                            clipElement.classList.remove('pasted');
                        }, 1000);
                    }
                }, 100);
            }

            // Update track width to accommodate the new clip
            updateTrackWidth();

            // Show success notification
            showNotification('Clip pasted');

            return true;
        } catch (error) {
            console.error('Error during paste operation:', error);
            showNotification(`Paste failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
            return false;
        }
    }

    // Function to handle keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Handle delete key (Delete or Backspace)
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // First priority: If a clip is selected, delete that
                if (selectedClipId) {
                    const clipElement = document.querySelector(`[data-clip-id="${selectedClipId}"]`);
                    if (clipElement) {
                        const trackElement = clipElement.closest('.track');
                        if (trackElement) {
                            const trackId = trackElement.getAttribute('data-track-id');
                            if (trackId) {
                                removeClip(trackId, selectedClipId);
                                return; // Exit after handling clip deletion
                            }
                        }
                    }
                }

                // Second priority: If a track is selected and no clip is selected, delete the track
                if (selectedTrackId && !selectedClipId) {
                    removeTrack(selectedTrackId);
                }
            }

            // Copy clip with Ctrl+C or Cmd+C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (copySelectedClip()) {
                    // Prevent default browser copy behavior
                    e.preventDefault();
                }
            }

            // Paste clip with Ctrl+V or Cmd+V
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (pasteClipToSelectedTrack()) {
                    // Prevent default browser paste behavior
                    e.preventDefault();
                }
            }
        });
    }

    // Function to add a clip to a track
    function addClipToTrack(trackId: string, clip: AudioClip) {
        console.log(`Adding clip "${clip.name}" to track ${trackId} (using trackService instance: ${audioEngine?.trackService === trackService ? 'FROM_AUDIO_ENGINE' : 'LOCAL'})`);
        trackService.addClipToTrack(trackId, clip);

        // Verify clip was added properly
        const track = trackService.getAllTracks().find(t => t.id === trackId);
        if (track) {
            console.log(`Track now has ${track.clips.length} clips`);
        } else {
            console.warn(`Track ${trackId} not found after adding clip`);
        }

        const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
        if (!trackElement) return;

        const clipContainer = trackElement.querySelector('.track-clips');
        if (!clipContainer) return;

        const clipElement = createClipElement(clip, pixelsPerSecond);
        clipContainer.appendChild(clipElement);

        // Set up all event handlers for the clip
        setupClipEventListeners(clipElement, clip, trackId);
    }

    // Function to set up all event listeners for a clip element
    function setupClipEventListeners(clipElement: HTMLElement, clip: AudioClip, trackId: string) {
        // Variables for custom drag behavior within track
        let isDragging = false;
        let startX = 0;
        let originalLeft = 0;
        let dragStart = false; // Used to track if we're in a potential drag operation
        let dragThreshold = 5; // Pixels to move before a click becomes a drag
        let wasWithinTrackDrag = false; // Track if we were doing a within-track drag

        // Handle clip selection - this is the primary event handler for selecting clips
        clipElement.addEventListener('click', (e) => {
            console.log(`Clip clicked: ${clip.id}`);

            // Don't handle clicks on action buttons
            if ((e.target as HTMLElement).closest('.clip-actions')) {
                console.log('Click on action button, ignoring selection');
                return;
            }

            // Don't handle clicks on trim handles
            if ((e.target as HTMLElement).classList.contains('trim-handle')) {
                console.log('Click on trim handle, ignoring selection');
                return;
            }

            // Toggle selection state
            const isAlreadySelected = clipElement.classList.contains('selected');
            console.log(`Clip was already selected: ${isAlreadySelected}`);

            // Clear any other selected clips first
            document.querySelectorAll('.audio-clip.selected').forEach(selectedClip => {
                if (selectedClip !== clipElement) {
                    console.log(`Deselecting other clip: ${selectedClip.getAttribute('data-clip-id')}`);
                    selectedClip.classList.remove('selected');
                }
            });

            // If it wasn't already selected, select it now
            if (!isAlreadySelected) {
                clipElement.classList.add('selected');
                selectedClipId = clip.id;
                console.log(`Selected clip: ${clip.id}`);
            } else {
                // If it was already selected, deselect it
                clipElement.classList.remove('selected');
                selectedClipId = null;
                console.log(`Deselected clip: ${clip.id}`);
            }
        });

        // Add event listeners for clip interaction - for dragging between tracks
        clipElement.addEventListener('dragstart', (e) => {
            console.log('dragstart fired', e.clientX, e.clientY);

            // Only proceed with the drag if we're not in the middle of a within-track drag
            if (isDragging || wasWithinTrackDrag) {
                console.log('preventing dragstart because within-track drag is active');
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Cancel any pending within-track drag detection
            if (dragStart) {
                dragStart = false;
                document.removeEventListener('mousemove', onMouseMoveInitial);
                document.removeEventListener('mouseup', onMouseUpInitial);
                clipElement.classList.remove('drag-potential');
            }

            const target = e.target as HTMLElement;
            target.classList.add('dragging');

            // Store the clip ID and track ID for the drop handler
            if (e.dataTransfer) {
                console.log('Setting data transfer for between-track drag');
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    clipId: clip.id,
                    trackId: trackId
                }));

                // Improve the drag image by using the clip element itself
                // This makes the drag/drop visual more intuitive
                try {
                    // Use a half-opacity clone of the element as the drag image
                    const clone = clipElement.cloneNode(true) as HTMLElement;
                    clone.style.opacity = '0.7';
                    clone.style.position = 'absolute';
                    clone.style.top = '-1000px';
                    document.body.appendChild(clone);

                    e.dataTransfer.setDragImage(clone, e.offsetX, e.offsetY);

                    // Clean up the clone after a short delay
                    setTimeout(() => {
                        document.body.removeChild(clone);
                    }, 100);
                } catch (err) {
                    console.warn('Could not set custom drag image:', err);
                }
            }
        });

        clipElement.addEventListener('dragend', (e) => {
            console.log('dragend fired');
            const target = e.target as HTMLElement;
            target.classList.remove('dragging');

            // Reset the wasWithinTrackDrag flag after a short delay
            setTimeout(() => {
                wasWithinTrackDrag = false;
            }, 100);
        });

        // Handle custom event for clip selection from other components
        clipElement.addEventListener('clip:select', (e: Event) => {
            const customEvent = e as CustomEvent;
            const { clipId, selected } = customEvent.detail;

            // Update the selected clip ID
            selectedClipId = selected ? clipId : null;
            console.log(`Clip ${clipId} ${selected ? 'selected' : 'deselected'}`);
        });

        // Handle clip deletion
        clipElement.addEventListener('clip:delete', (e: Event) => {
            const customEvent = e as CustomEvent;
            const { clipId } = customEvent.detail;

            removeClip(trackId, clipId);
        });

        // We'll use two different dragging modes:
        // 1. Native drag-and-drop (for moving between tracks) - triggered by dragging outside the clip container
        // 2. Custom drag behavior (for repositioning within a track) - triggered by direct click and drag

        // Mouse down event to begin tracking potential drag
        clipElement.addEventListener('mousedown', (e) => {
            // Don't start dragging if we clicked on a button or action element
            if ((e.target as HTMLElement).closest('.clip-actions')) {
                return;
            }

            // Don't handle clicks on trim handles
            if ((e.target as HTMLElement).classList.contains('trim-handle')) {
                return;
            }

            // Start tracking potential drag
            dragStart = true;
            startX = e.clientX;
            originalLeft = parseInt(clipElement.style.left || '0', 10);

            // Ensure draggable is enabled for between-track drags
            clipElement.draggable = true;
            wasWithinTrackDrag = false;

            // Listen for mouse movements to detect if this becomes a drag
            document.addEventListener('mousemove', onMouseMoveInitial);
            document.addEventListener('mouseup', onMouseUpInitial);

            // Add class to show we're possibly starting a drag
            clipElement.classList.add('drag-potential');
        });

        // Initial mouse move handler to see if this is a drag or just a click
        function onMouseMoveInitial(e: MouseEvent) {
            if (!dragStart) return;

            // Check if we've moved enough to consider this a drag
            const deltaX = Math.abs(e.clientX - startX);

            if (deltaX > dragThreshold) {
                // This is a drag operation - disable native dragging and enable custom drag
                isDragging = true;
                dragStart = false;
                wasWithinTrackDrag = true;

                // Disable native drag-and-drop during our custom drag
                clipElement.draggable = false;

                // Switch to the real mouse move handler
                document.removeEventListener('mousemove', onMouseMoveInitial);
                document.removeEventListener('mouseup', onMouseUpInitial);

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);

                // Update visual style
                clipElement.classList.remove('drag-potential');
                clipElement.classList.add('dragging-within-track');

                // Since we're now committed to a within-track drag, prevent default on the original event
                e.preventDefault();
            }
        }

        // Clean up if this wasn't a drag but just a click
        function onMouseUpInitial() {
            dragStart = false;
            document.removeEventListener('mousemove', onMouseMoveInitial);
            document.removeEventListener('mouseup', onMouseUpInitial);
            clipElement.classList.remove('drag-potential');
        }

        function onMouseMove(e: MouseEvent) {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const newLeft = Math.max(0, originalLeft + deltaX);
            clipElement.style.left = `${newLeft}px`;

            // Update clip data
            const newStartTime = newLeft / pixelsPerSecond;
            clip.startTime = newStartTime;

            // Update data attribute for zoom changes
            clipElement.dataset.startTime = newStartTime.toString();
        }

        function onMouseUp() {
            if (!isDragging) return;

            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // Remove dragging class
            clipElement.classList.remove('dragging-within-track');

            // Re-enable native drag-and-drop AFTER a slight delay
            // This prevents accidental dragstart events after mouseup
            setTimeout(() => {
                clipElement.draggable = true;
                wasWithinTrackDrag = false;
            }, 100);

            // Update the clip position in the track service
            trackService.updateClipPosition(trackId, clip.id, clip.startTime);

            // Check if audio is currently playing
            const isPlaying = audioEngine?.isPlaying || false;

            // If audio is playing, restart it to reflect the new clip position
            if (isPlaying && audioEngine) {
                const currentPlaybackTime = audioEngine.currentTime;
                console.log(`Audio is currently playing at position ${currentPlaybackTime}s, restarting to update clip position`);

                // Restart playback from where we left off
                audioEngine.stopPlayback();
                audioEngine.seekTo(currentPlaybackTime);
                audioEngine.startPlayback();
            }

            // Show visual feedback
            clipElement.classList.add('moved-within-track');
            setTimeout(() => {
                clipElement.classList.remove('moved-within-track');
            }, 300);
        }
    }

    // Setup individual track drop zone
    function setupTrackDropZone(dropZone: Element | null) {
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Get parent track
                const trackElement = dropZone.closest('.track');
                if (trackElement) {
                    // Select this track when dragging over it
                    if (trackElement.getAttribute('data-track-id') !== selectedTrackId) {
                        // Deselect all tracks
                        document.querySelectorAll('.track').forEach(el => {
                            el.classList.remove('selected');
                        });

                        // Select this track
                        trackElement.classList.add('selected');
                        selectedTrackId = trackElement.getAttribute('data-track-id');
                        console.log(`Selected track for drop: ${selectedTrackId}`);
                    }

                    // Determine if we're dragging a clip or a file
                    const dragEvent = e as DragEvent;
                    if (dragEvent.dataTransfer?.types.includes('text/plain')) {
                        // Likely dragging a clip - use special highlight
                        dropZone.classList.add('drag-highlight-clip');
                    } else if (dragEvent.dataTransfer?.types.includes('Files')) {
                        // Dragging files
                        dropZone.classList.add('drag-highlight');
                    }
                }
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-highlight');
                dropZone.classList.remove('drag-highlight-clip');
            });
        });

        // Handle drop on this specific track
        dropZone.addEventListener('drop', async (e) => {
            const dragEvent = e as DragEvent;
            console.log('Drop event on track dropzone:', dragEvent);

            // First check if this is a clip being dragged (not a file)
            if (dragEvent.dataTransfer) {
                try {
                    // Force reading the data by checking if it exists
                    if (dragEvent.dataTransfer.types.includes('text/plain')) {
                        try {
                            const dataText = dragEvent.dataTransfer.getData('text/plain');
                            console.log('Drop data text:', dataText);

                            if (dataText) {
                                try {
                                    const transferData = JSON.parse(dataText);
                                    console.log('Parsed drop data:', transferData);

                                    if (transferData.clipId && transferData.trackId) {
                                        console.log("Detected clip drop with data:", transferData);
                                        // This is a clip being dragged
                                        handleClipDrop(dragEvent, dropZone, transferData);
                                        return; // Exit early since this is a clip drop, not a file drop
                                    }
                                } catch (parseError) {
                                    console.warn('Failed to parse drop data JSON:', parseError);
                                    // Continue with file drop handling
                                }
                            }
                        } catch (dataError) {
                            console.warn('Error reading dataTransfer data:', dataError);
                            // This can happen if the data was not properly set in the dragstart handler
                            // Continue with file drop handling
                        }
                    } else {
                        console.log('Drop data does not include text/plain:', dragEvent.dataTransfer.types);
                    }
                } catch (error) {
                    // If reading dataTransfer fails, continue with file drop
                    console.log('Error accessing dataTransfer:', error);
                }
            }

            // If we reach here, handle as a normal file drop
            if (dragEvent.dataTransfer?.files.length) {
                await handleFileDrop(dragEvent, dropZone);
            } else {
                console.log('No files in drop, and not a clip drop:', dragEvent);
            }
        });
    }

    // Handle file drop for audio files
    async function handleFileDrop(e: Event, dropZone: Element) {
        const dragEvent = e as DragEvent;
        if (!dragEvent.dataTransfer?.files.length) return;

        console.log(`File drop detected with ${dragEvent.dataTransfer.files.length} files`);

        const trackElement = dropZone.closest('.track');
        if (!trackElement) {
            console.warn('No track element found for drop');
            return;
        }

        const trackId = trackElement.getAttribute('data-track-id');
        if (!trackId) {
            console.warn('No track ID found for drop');
            return;
        }

        console.log(`Files dropped on track ${trackId}`);

        // Log file types for debugging
        Array.from(dragEvent.dataTransfer.files).forEach(file => {
            console.log(`File: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`);
        });

        const files = Array.from(dragEvent.dataTransfer.files).filter(file =>
            file.type.startsWith('audio/') ||
            file.name.endsWith('.mp3') ||
            file.name.endsWith('.wav') ||
            file.name.endsWith('.ogg') ||
            file.name.endsWith('.aac')
        );

        console.log(`Filtered to ${files.length} audio files`);

        if (files.length === 0) {
            // Show error styling if no audio files
            console.warn('No audio files found in drop');
            dropZone.classList.add('drag-error');
            setTimeout(() => dropZone.classList.remove('drag-error'), 1500);
            return;
        }

        // Calculate position based on drop coordinates
        const rect = dropZone.getBoundingClientRect();
        const dropX = dragEvent.clientX - rect.left;
        const startTime = Math.max(0, dropX / pixelsPerSecond);
        console.log(`Calculated drop position: ${startTime}s (x: ${dropX}px, pixelsPerSecond: ${pixelsPerSecond})`);

        // Show loading indicator with message for the file(s) being loaded
        const loader = showLoadingIndicator("Loading audio files...");

        // Since mp3 files might take longer to decode, give user feedback
        for (const file of files) {
            const fileExtension = file.name.split('.').pop()?.toLowerCase();
            const isMP3 = file.type === 'audio/mp3' || file.type === 'audio/mpeg' || (fileExtension === 'mp3');
            if (isMP3) {
                loader.updateMessage(`Processing MP3 file: ${file.name}`);
            }
        }

        try {
            // Process each file sequentially
            for (const file of files) {
                try {
                    console.log(`Loading audio file ${file.name}...`);

                    // Make sure the audio context is running
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                        console.log('Audio context resumed for file loading');
                    }

                    const audioBuffer = await audioFileService.loadAudioFile(file);
                    console.log(`Audio file loaded, duration: ${audioBuffer.duration}s, channels: ${audioBuffer.numberOfChannels}`);

                    const clip: AudioClip = {
                        id: crypto.randomUUID(),
                        buffer: audioBuffer,
                        startTime,
                        duration: audioBuffer.duration,
                        offset: 0,
                        name: file.name
                    };

                    console.log(`Adding clip to track ${trackId} at ${startTime}s`);
                    addClipToTrack(trackId, clip);

                    // Update track width to accommodate the new clip
                    updateTrackWidth();

                    // Center view on the new clip
                    centerViewOnTime(clip.startTime + (clip.duration / 2), pixelsPerSecond);
                } catch (error) {
                    console.error(`Error loading audio file ${file.name}:`, error);
                    showErrorNotification(`Failed to load "${file.name}": ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        } finally {
            // Hide loading indicator
            hideLoadingIndicator();
        }
    }

    // Set up document-level drag and drop handling
    function setupGlobalDragAndDrop() {
        // Prevent default behavior for the entire document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Highlight all track-clips when dragging over the document
        document.addEventListener('dragenter', (e) => {
            if (e.dataTransfer?.types.includes('Files')) {
                const trackClips = document.querySelectorAll('.track-clips');
                trackClips.forEach(zone => {
                    zone.classList.add('drag-highlight');
                });
            }
        });

        document.addEventListener('dragleave', (e) => {
            // Only remove highlight if leaving the document
            if (e.target === document.documentElement) {
                const trackClips = document.querySelectorAll('.track-clips');
                trackClips.forEach(zone => {
                    zone.classList.remove('drag-highlight');
                });
            }
        });

        document.addEventListener('drop', () => {
            // Remove all highlights on drop
            const trackClips = document.querySelectorAll('.track-clips');
            trackClips.forEach(zone => {
                zone.classList.remove('drag-highlight');
            });
        });
    }

    // Initialize drag and drop
    setupGlobalDragAndDrop();

    // Add an initial track
    const initialTrack = trackService.addTrack();
    addTrackToUI(initialTrack);
}

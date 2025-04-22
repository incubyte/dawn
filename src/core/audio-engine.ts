import { AudioFileService, createAudioFileService } from '../services/audio-file-service';
import { createTrackService, TrackService } from '../services/track-service';
import { createProjectService, ProjectService } from '../services/project-service';
import { AudioTrack } from '../models/audio-track';
import { assert, assertNotNullOrUndefined } from '../utils/assert';
import { AudioClip } from '../models/audio-clip';

export interface AudioEngine {
    audioContext: AudioContext;
    masterGainNode: GainNode;
    trackService: TrackService;
    projectService: ProjectService;
    masterGain: number;
    isPlaying: boolean;
    currentTime: number;
    startPlayback(startTime?: number): void;
    stopPlayback(): void;
    pausePlayback(): void;
    seekTo(time: number): void;
    exportMix(): Promise<Blob>;
    saveProject(name: string): Promise<Blob>;
    loadProject(file: File): Promise<boolean>;
}

export class AudioEngineImpl implements AudioEngine {
    audioContext: AudioContext = new AudioContext();
    masterGainNode: GainNode;
    trackService: TrackService;
    projectService: ProjectService;
    audioFileService: AudioFileService;
    isPlaying: boolean;
    playbackStartTime: number = 0;
    playbackOffset: number = 0;
    activeSources: AudioNode[] = [];
    private static _instance: AudioEngineImpl;

    private constructor() {
        this.audioContext = new AudioContext();
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.connect(this.audioContext.destination);
        this.trackService = createTrackService(this.audioContext, this.masterGainNode);
        this.projectService = createProjectService(this.audioContext, this.trackService);
        this.audioFileService = createAudioFileService(this.audioContext);
        this.isPlaying = false;
    }

    static instance(): AudioEngine {
        if (!AudioEngineImpl._instance) {
            AudioEngineImpl._instance = new AudioEngineImpl();
        }
        return AudioEngineImpl._instance;
    }

    get currentTime(): number {
        if (this.isPlaying) {
            return this.audioContext.currentTime - this.playbackStartTime + this.playbackOffset;
        }
        return this.playbackOffset;
    }

    get masterGain(): number {
        return this.masterGainNode.gain.value;
    }

    set masterGain(value: number) {
        this.masterGainNode.gain.value = Math.max(0, Math.min(1, value));
    }

    startPlayback(startTime?: number): void {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume()
                .then(() => this.startPlayback(startTime))
                .catch(err => {
                    console.error('Failed to resume audio context:', err);
                });
            return;
        }

        this.stopPlayback();
        if (startTime !== undefined) {
            this.playbackOffset = startTime;
        }
        this.isPlaying = true;
        this.playbackStartTime = this.audioContext.currentTime;

        const tracks: AudioTrack[] = this.trackService.getAllTracks();
        if (tracks.length === 0) {
            const testOscillator = this.createTestTone(this.audioContext, this.masterGainNode);
            this.activeSources.push(testOscillator);
            return;
        }

        let hasClips = false;
        const soloActive = tracks.some(t => t.solo);
        tracks.forEach((track: AudioTrack) => {
            if (soloActive && !track.solo) {
                return;
            }
            if (track.muted) {
                return;
            }

            if (track.clips.length === 0) {
                return;
            }
            const trackGainNode = this.trackService.getTrackGainNode(track.id);
            assertNotNullOrUndefined(trackGainNode, "[No Gain Node] TrackId: " + track.id);
            const result = track.clips.map((clip: AudioClip) => {
                return this.setUpSources(track, clip, trackGainNode);
            });
            hasClips = result.some(Boolean);
        });

        if (!hasClips) {
            const testOscillator = this.createTestTone(this.audioContext, this.masterGainNode);
            this.activeSources.push(testOscillator);
        }
    }

    private setUpSources(track: AudioTrack, clip: AudioClip, trackGainNode: GainNode) : boolean {
        if (!clip.buffer) {
            return false;
        }
        if (clip.buffer.length === 0 || clip.buffer.numberOfChannels === 0) {
            return false;
        }

        const clipStartTime = clip.startTime;
        const clipEndTime = clipStartTime + clip.duration;

        if (clipEndTime <= this.playbackOffset) {
            return false;
        }
        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = clip.buffer;
            source.connect(trackGainNode);
            if (track.effects.length > 0) {
                track.effects.forEach(effect => {
                    this.trackService.applyEffectParameters(effect);
                });
                this.trackService.rebuildEffectChain(track.id);
            }
            let startDelay = clipStartTime - this.playbackOffset;
            if (startDelay < 0) {
                const offset = -startDelay;
                const duration = clip.duration - offset;
                if (duration <= 0) {
                    return false;
                }
                assert(offset <= clip.buffer.duration, "[Offset Out Of Range] ClipId: " + clip.id);
                assert(duration <= (clip.buffer.duration - offset), "[Duration Out Of Range] ClipId: " + clip.id);
                try {
                    source.start(0, offset, duration);
                }
                catch (err) {
                    console.error(`Error starting clip ${clip.id}`, err);
                }
            }
            else {
                assert(clip.duration <= (clip.buffer.duration), "[Duration Out Of Range] ClipId: " + clip.id);
                try {
                    const startTime = this.audioContext.currentTime + startDelay;
                    source.start(startTime, 0, clip.duration);
                }
                catch (err) {
                    console.error(`Error starting clip ${clip.id}`, err);
                }
            }
            this.activeSources.push(source);
        }
        catch (err) {
            console.error(`[Unable To SetUp Clip] ClipId: ${clip.id}`, err);
        }
        return true;
    }


    private createTestTone(audioContext: AudioContext, masterGainNode: GainNode): OscillatorNode {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = 440; //A Note
        gainNode.connect(masterGainNode);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 1.0);
        return oscillator;
    }

    stopPlayback(): void {
        if (!this.isPlaying) {
            return;
        }
        this.isPlaying = false;
        this.playbackOffset = 0;
        this.stopAllActiveSources();
    }

    private stopAllActiveSources() {
        this.activeSources.forEach((source, ind) => {
            try {
                if ('stop' in source) {
                    (source as AudioScheduledSourceNode).stop();
                }
            }
            catch (err) {
                console.warn(`[Error Stopping Source] Index: ${ind}`, err);
            }
        })
        this.activeSources = [];
    }


    pausePlayback(): void {
        if (!this.isPlaying) {
            return;
        }
        this.isPlaying = false;
        this.playbackOffset = this.audioContext.currentTime - this.playbackStartTime + this.playbackOffset;
        this.stopAllActiveSources();
    }

    seekTo(time: number): void {
        assert(time >= 0, "[seekTo] time cannot be negative");
        const wasPlaying = this.isPlaying;
        if (this.isPlaying) {
            this.pausePlayback();
        }
        this.playbackOffset = time;
        if (wasPlaying) {
            this.startPlayback();
        }
    }

    // TODO: Fix double export issue
    async exportMix(): Promise<Blob> {
        const tracks = this.trackService.getAllTracks();
        let maxDuration = 0;

        tracks.forEach(track => {
            const clipEndTimes = track.clips.map(clip => clip.startTime + clip.duration);
            maxDuration = Math.max(maxDuration, ...clipEndTimes);
        })
        maxDuration += 1;

        const sampleRate = this.audioContext.sampleRate;
        const offlineContext = new OfflineAudioContext(2, Math.ceil(maxDuration * sampleRate), sampleRate);
        const offlineMasterGain = offlineContext.createGain();
        offlineMasterGain.connect(offlineContext.destination);

        tracks.map(track => {
            const trackGain = offlineContext.createGain();
            trackGain.gain.value = track.gainValue;
            trackGain.connect(offlineMasterGain);

            //TODO: Handle SOLO
            if (track.muted) {
                trackGain.gain.value = 0;
            }

            track.clips.map(clip => {
                if (!clip.buffer) {
                    return;
                }
                const source = offlineContext.createBufferSource();
                source.buffer = clip.buffer;
                source.connect(trackGain);
                source.start(clip.startTime, clip.offset, clip.duration);
            })
        });
        const renderedBuffer = await offlineContext.startRendering();
        return this.audioFileService.exportAudioBuffer(renderedBuffer, 'daw-export.wav');
    }

    async saveProject(name: string): Promise<Blob> {
        const wasPlaying = this.isPlaying;
        if (this.isPlaying) {
            this.pausePlayback();
        }
        try {
            const projectBlob = await this.projectService.saveProject(name);
            if (wasPlaying) {
                this.startPlayback();
            }
            return projectBlob;
        }
        catch (err) {
            console.error('[ERROR: Save project:', err);
            if (wasPlaying) {
                this.startPlayback();
            }
            throw err;
        }
    }

    async loadProject(file: File): Promise<boolean> {
        if (this.isPlaying) {
            this.stopPlayback();
        }
        try {
            const result = await this.projectService.loadProject(file);
            if (result) {
                document.dispatchEvent(new CustomEvent('updateTrackWidth'));
                return true;
            }
            else {
                return false;
            }
        }
        catch (err) {
            console.error('[ERROR: Failed to load project', err);
            return false;
        }
    }
}

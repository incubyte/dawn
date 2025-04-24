import { AudioClip } from '../models/audio-clip';
import { Effect } from '../models/effect';
import { TrackService } from './track-service';
import { createReverbEffect } from '../effects/reverb';
import { createDelayEffect } from '../effects/delay';
import JSZip from 'jszip';
import { AudioTrack } from '../models/audio-track';
import { assert, assertNotNullOrUndefined } from '../utils/assert';

export interface SerializableProject {
    version: string;
    name: string;
    tracks: SerializableTrack[];
    createdAt: string;
    updatedAt: string;
}

export interface SerializableTrack {
    id: string;
    gainValue: number;
    muted: boolean;
    solo: boolean;
    clips: SerializableClip[];
    effects: SerializableEffect[];
}

export interface SerializableEffect {
    id: string;
    type: string;
    bypass: boolean;
    parameters: SerializableEffectParameter[];
}

export interface SerializableEffectParameter {
    name: string;
    value: number;
    min: number;
    max: number;
    step: number;
}

export interface SerializableClip {
    id: string;
    name: string;
    startTime: number;
    duration: number;
    offset: number;
    audioFileName: string; // Reference to the separate audio file
}

export interface ProjectService {
    saveProject(name: string): Promise<Blob>;
    loadProject(file: File): Promise<boolean>;
    getProjectAsJSON(): Promise<SerializableProject>;
    getCurrentProjectName(): string | null;
    getOriginalFileName(): string | null;
    hasUnsavedChanges(): boolean;
}

export class ProjectServiceImpl implements ProjectService {
    audioContext: AudioContext;
    trackService: TrackService;
    currentProjectName: string | null = null;
    originalFileName: string | null = null;
    lastSavedState: string | null = null;

    constructor(audioContext: AudioContext, trackService: TrackService) {
        this.audioContext = audioContext;
        this.trackService = trackService;
        this.addEventListener();
    }

    private addEventListener() {
        document.addEventListener('track:changed', () => {
            console.log('Track changed event detected, project now has unsaved changes');
        });
        document.addEventListener('clip:changed', () => {
            console.log('Clip changed event detected, project now has unsaved changes');
        });
    }

    async saveProject(name: string): Promise<Blob> {
        this.currentProjectName = name;
        const zip = new JSZip();
        const project = await this.getProjectAsJSONInternal();
        zip.file("project.json", JSON.stringify(project, null, 2));
        this.addAudiosToZip(zip);

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        this.lastSavedState = JSON.stringify(project);
        return zipBlob;
    }

    private async addAudiosToZip(zip: JSZip) {
        const audioFolder = zip.folder("audio");
        assert(audioFolder, "Failed to create audio folder in zip file");

        const tracks = this.trackService.getAllTracks();
        for (const track of tracks) {
            for (const clip of track.clips) {
                if (!clip.buffer) {
                    console.warn(`Clip ${clip.name} has no audio buffer to save`);
                    continue;
                }
                try {
                    const wavBlob = await audioBufferToWavBlob(clip.buffer);
                    const arrayBuffer = await wavBlob.arrayBuffer();
                    audioFolder.file(`${clip.id}.wav`, arrayBuffer);
                }
                catch (err) {
                    console.warn(`Failed to encode audio for clip ${clip.name}: `, err);
                }
            }
        }
    }

    async loadProject(file: File): Promise<boolean> {
        try {
            this.originalFileName = file.name;
            const zip = new JSZip();
            const zipContents = await zip.loadAsync(file);
            const project = await this.loadProjectJSON(zipContents);
            this.currentProjectName = project.name;
            this.lastSavedState = JSON.stringify(project);
            this.removeExistingTracks();
            for (const serializedTrack of project.tracks) {
                const track = this.trackService.addTrack(serializedTrack.id);
                this.trackService.setTrackVolume(track.id, serializedTrack.gainValue);
                if (serializedTrack.muted) {
                    this.trackService.toggleMute(track.id);
                }
                if (serializedTrack.solo) {
                    this.trackService.toggleSolo(track.id);
                }
                this.addEffectsToTracks(serializedTrack, track);
                await this.addAudioClipsToTrack(serializedTrack, zipContents, track.id);
            }
            document.dispatchEvent(new CustomEvent('project:loaded', {
                detail: {
                    name: project.name,
                    fileName: this.originalFileName
                }
            }));
            return true;
        }
        catch (err) {
            console.error('Error loading project:', err);
            this.originalFileName = null;
            return false;
        }
    }

    private async addAudioClipsToTrack(serializedTrack: SerializableTrack, zipContents: JSZip, trackId: string) {
        for (const serializedClip of serializedTrack.clips) {
            try {
                const audioPath = `audio/${serializedClip.id}.wav`;
                const audioFile = zipContents.file(audioPath);
                if (!audioFile) {
                    console.warn(`Audio file not found for clip: ${serializedClip.name}`);
                    continue;
                }
                const audioData = await audioFile.async('arraybuffer');
                const audioBuffer = await decodeAudioData(audioData, this.audioContext);
                const clip: AudioClip = {
                    id: serializedClip.id,
                    buffer: audioBuffer,
                    startTime: serializedClip.startTime,
                    duration: serializedClip.duration,
                    offset: serializedClip.offset,
                    name: serializedClip.name
                }
                this.trackService.addClipToTrack(trackId, clip);
            }
            catch (err) {
                console.error(`Failed to load audio clip for clip ${serializedClip.name}:`, err);
            }
        }
    }

    private addEffectsToTracks(serializedTrack: SerializableTrack, track: AudioTrack) {
        if (!serializedTrack.effects || serializedTrack.effects.length <= 0) {
            return;
        }
        for (const serializedEffect of serializedTrack.effects) {
            try {
                let effect: Effect | null = null;
                if (serializedEffect.type === 'reverb') {
                    effect = createReverbEffect(this.audioContext);
                }
                else if (serializedEffect.type === 'delay') {
                    effect = createDelayEffect(this.audioContext);
                }
                else {
                    assert(false, 'Invalid effect on track: ' + track.id);
                }
                assertNotNullOrUndefined(effect, 'Failed to create effect for track: ' + track.id);
                effect.id = serializedEffect.id;
                effect.bypass = serializedEffect.bypass;
                this.trackService.addEffectToTrack(track.id, effect);
                for (const savedParam of serializedEffect.parameters) {
                    const paramIndex = effect.parameters.findIndex(p => p.name === savedParam.name);
                    if (paramIndex >= 0) {
                        this.trackService.updateEffectParameter(track.id, effect.id, savedParam.name, savedParam.value);
                    }
                }
            }
            catch (err) {
                console.error(`Failed to restore effect ${serializedEffect.type}:`, err);
            }
        }
    }

    private removeExistingTracks() {
        const existingTracks = this.trackService.getAllTracks();
        existingTracks.forEach(track => {
            this.trackService.removeTrack(track.id);
        });

    }

    private async loadProjectJSON(zipContents: JSZip) {
        const projectFile = zipContents.file('project.json');
        if (!projectFile) {
            throw new Error("Invalid project file: no project.json found");
        }
        const projectJSON = await projectFile.async('text');
        const project = JSON.parse(projectJSON) as SerializableProject;
        // TODO: Add robost validation
        if (!project.version || !project.tracks) {
            throw new Error('Invalid project file format');
        }
        return project;
    }

    getProjectAsJSON(): Promise<SerializableProject> {
        return this.getProjectAsJSONInternal();
    }

    private async getProjectAsJSONInternal(): Promise<SerializableProject> {
        const tracks = this.trackService.getAllTracks();
        const serializedTracks: SerializableTrack[] = [];

        for (const track of tracks) {
            const serializedClips: SerializableClip[] = track.clips.map(this.mapClip);
            const serializedEffects: SerializableEffect[] = track.effects.map(this.mapEffect);
            const serializedTrack: SerializableTrack = this.mapTrack(track, serializedClips, serializedEffects);
            serializedTracks.push(serializedTrack);
        };

        const projectName = this.currentProjectName || 'Untitled Project';
        const now = new Date().toISOString();
        const project: SerializableProject = {
            version: '1.0',
            name: projectName,
            tracks: serializedTracks,
            createdAt: now,
            updatedAt: now
        }
        return project;
    }

    private mapClip(clip: AudioClip) {
        return {
            id: clip.id,
            name: clip.name,
            startTime: clip.startTime,
            duration: clip.duration,
            offset: clip.offset,
            audioFileName: `${clip.id}.wav`
        };
    }

    private mapEffect(effect: Effect) {
        return {
            id: effect.id,
            type: effect.type,
            bypass: effect.bypass,
            parameters: effect.parameters.map(param => ({
                name: param.name,
                value: param.value,
                min: param.min,
                max: param.max,
                step: param.step
            }))
        };
    }

    private mapTrack(track: AudioTrack, serializedClips: SerializableClip[], serializedEffects: SerializableEffect[]) {
        return {
            id: track.id,
            gainValue: track.gainValue,
            muted: track.muted,
            solo: track.solo,
            clips: serializedClips,
            effects: serializedEffects
        };
    }

    getCurrentProjectName(): string | null {
        return this.currentProjectName;
    }

    getOriginalFileName(): string | null {
        return this.originalFileName;
    }

    hasUnsavedChanges(): boolean {
        if (!this.lastSavedState) {
            return true;
        }
        // TODO: Compare tree
        return true;
    }
}

/**
 * Convert an AudioBuffer to a WAV Blob
 */
async function audioBufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
    return new Promise((resolve, reject) => {
        try {
            console.log(`Converting AudioBuffer to WAV: ${buffer.duration}s, ${buffer.numberOfChannels} channels, ${buffer.sampleRate}Hz`);

            // Convert directly to WAV format
            const wavArrayBuffer = audioBufferToWav(buffer);
            console.log(`Converted to WAV, size: ${wavArrayBuffer.byteLength} bytes`);

            // Create a Blob with explicit MIME type
            const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
            console.log(`Created WAV Blob, size: ${blob.size} bytes`);

            resolve(blob);
        } catch (error) {
            console.error('Error converting buffer to WAV:', error);
            reject(error);
        }
    });
}

/**
 * Decode audio data from an ArrayBuffer
 */
async function decodeAudioData(arrayBuffer: ArrayBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
        try {
            audioContext.decodeAudioData(
                arrayBuffer,
                buffer => resolve(buffer),
                error => reject(error)
            );
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Convert an AudioBuffer to WAV format
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM format
    const bitDepth = 16; // 16-bit audio

    // Calculate sizes
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44; // WAV header size
    const totalSize = headerSize + dataSize;

    // Create buffer
    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    // Write WAV header
    // "RIFF" chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // 16 bytes for fmt chunk
    view.setUint16(20, format, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    const channels = [];
    for (let i = 0; i < numOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    const samples = buffer.length;

    for (let i = 0; i < samples; i++) {
        for (let channel = 0; channel < numOfChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channels[channel][i]));
            const value = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
            view.setInt16(offset, value, true);
            offset += 2;
        }
    }

    return arrayBuffer;
}

// Helper to write strings to DataView
function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

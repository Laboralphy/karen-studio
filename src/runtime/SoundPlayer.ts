import { sfxr } from 'jsfxr';
import type { SoundAsset } from '../project/model';
import { SAMPLE_RATE, SAMPLE_SIZE, synthParams } from '../project/sound';

/** A sound being played; `stop` cuts it. */
export interface SoundHandle {
    stop(): void;
}

/**
 * Renders the project's sound effects (jsfxr) and plays them through WebAudio.
 * Without an audio context (tests, no sound card) sounds are silent, but their
 * durations are still known, so game timing does not change.
 */
export class SoundPlayer {
    private readonly _buffers = new Map<number, AudioBuffer>();
    private readonly _durations = new Map<number, number>();

    constructor(private readonly _context: BaseAudioContext | null) {}

    /** Render every sound once, before the game starts. */
    prepare(sounds: readonly SoundAsset[]): void {
        for (const sound of sounds) {
            const params = synthParams(sound.params);
            if (this._context) {
                const buffer = sfxr.toWebAudio(params, this._context).buffer!;
                this._buffers.set(sound.id, buffer);
                this._durations.set(sound.id, buffer.duration);
            } else {
                const bytes = sfxr.toBuffer(params).length;
                this._durations.set(sound.id, bytes / (SAMPLE_SIZE / 8) / SAMPLE_RATE);
            }
        }
    }

    /** True if the sound was prepared. */
    has(id: number): boolean {
        return this._durations.has(id);
    }

    /** Duration of a prepared sound, in seconds. */
    duration(id: number): number {
        return this._durations.get(id) ?? 0;
    }

    /** Start playing a prepared sound. Returns null when there is no audio output. */
    play(id: number): SoundHandle | null {
        const context = this._context;
        const buffer = this._buffers.get(id);
        if (!context || !buffer) {
            return null;
        }
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start();
        return {
            stop: () => {
                try {
                    source.stop();
                } catch {
                    // Already stopped.
                }
            },
        };
    }
}

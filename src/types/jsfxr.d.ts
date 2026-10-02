/** Minimal typing of the `jsfxr` package (8-bit sound effect generator). */
declare module 'jsfxr' {
    /** Synth parameters: `wave_type`, `p_*` (0–1, some signed −1–1), `sound_vol`, `sample_*`. */
    export type SfxrParams = Record<string, number>;
    export const sfxr: {
        /** Create parameters with a preset algorithm (randomised), e.g. 'jump'. */
        generate(algorithm: string, options?: Partial<SfxrParams>): SfxrParams;
        /** Raw sample bytes (little-endian, `sample_size` bits per sample). */
        toBuffer(params: SfxrParams): number[];
        /** A WebAudio source node whose `buffer` holds the rendered sound. */
        toWebAudio(params: SfxrParams, context: BaseAudioContext): AudioBufferSourceNode;
    };
}

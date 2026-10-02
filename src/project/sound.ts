/**
 * Sound effects (jsfxr parameters): definitions for the editor, presets, mutation.
 * A sound is stored as its synth parameters, not as audio: it is rendered when played.
 */

/** Parameter values: jsfxr names (`wave_type`, `p_*`, `sound_vol`) → number. */
export type SoundParams = Record<string, number>;

/** Wave shapes (`wave_type`). */
export const WAVES: { value: number; label: string }[] = [
    { value: 0, label: 'Carré' },
    { value: 1, label: 'Dents de scie' },
    { value: 2, label: 'Sinus' },
    { value: 3, label: 'Bruit' },
];

/** Description of a slider parameter. */
export interface ParamDef {
    key: string;
    label: string;
    /** True if the value goes from −1 to 1 instead of 0 to 1. */
    signed: boolean;
    /** Shown in the simple view (otherwise only in « réglages avancés »). */
    simple: boolean;
    /** Default value. */
    default: number;
}

const def = (
    key: string,
    label: string,
    defaultValue: number,
    signed = false,
    simple = false
): ParamDef => ({
    key,
    label,
    signed,
    simple,
    default: defaultValue,
});

/** Every slider parameter, in display order. */
export const PARAMS: ParamDef[] = [
    def('p_base_freq', 'Hauteur', 0.3, false, true),
    def('p_freq_ramp', 'Glissement', 0, true, true),
    def('p_env_sustain', 'Durée', 0.3, false, true),
    def('p_env_decay', 'Extinction', 0.4, false, true),
    def('p_env_punch', 'Punch', 0, false, true),
    def('p_vib_strength', 'Vibrato', 0, false, true),
    def('sound_vol', 'Volume', 0.5, false, true),
    def('p_env_attack', 'Attaque', 0),
    def('p_freq_limit', 'Hauteur minimale', 0),
    def('p_freq_dramp', 'Accélération du glissement', 0, true),
    def('p_vib_speed', 'Vitesse du vibrato', 0),
    def('p_arp_mod', 'Saut de note', 0, true),
    def('p_arp_speed', 'Moment du saut de note', 0),
    def('p_duty', 'Largeur du carré', 0),
    def('p_duty_ramp', 'Variation de la largeur', 0, true),
    def('p_repeat_speed', 'Répétition', 0),
    def('p_pha_offset', 'Effet phaser', 0, true),
    def('p_pha_ramp', 'Variation du phaser', 0, true),
    def('p_lpf_freq', 'Filtre passe-bas', 1),
    def('p_lpf_ramp', 'Variation du passe-bas', 0, true),
    def('p_lpf_resonance', 'Résonance', 0),
    def('p_hpf_freq', 'Filtre passe-haut', 0),
    def('p_hpf_ramp', 'Variation du passe-haut', 0, true),
];

/** Fixed rendering settings. */
export const SAMPLE_RATE = 44100;
export const SAMPLE_SIZE = 8;

/** Default parameters (a short square beep). */
export function defaultSoundParams(): SoundParams {
    const params: SoundParams = { wave_type: 0 };
    for (const p of PARAMS) {
        params[p.key] = p.default;
    }
    return params;
}

const clamp = (v: number, signed: boolean) => Math.min(1, Math.max(signed ? -1 : 0, v));

/**
 * Keep only known parameters, with valid values (missing ones get their default).
 * Used when loading files and when importing jsfxr presets.
 */
export function normalizeSoundParams(input: Record<string, unknown>): SoundParams {
    const params = defaultSoundParams();
    const wave = Number(input.wave_type);
    params.wave_type = WAVES.some((w) => w.value === wave) ? wave : 0;
    for (const p of PARAMS) {
        const v = Number(input[p.key]);
        if (Number.isFinite(v)) {
            params[p.key] = clamp(v, p.signed);
        }
    }
    return params;
}

/** Parameters ready for jsfxr (adds the fixed sample settings). */
export function synthParams(params: SoundParams): SoundParams {
    return { ...params, sample_rate: SAMPLE_RATE, sample_size: SAMPLE_SIZE };
}

/** Presets offered in the editor: [jsfxr algorithm, label]. */
export const PRESETS: [string, string][] = [
    ['pickupCoin', 'Trésor'],
    ['powerUp', 'Bonus'],
    ['jump', 'Saut'],
    ['laserShoot', 'Tir'],
    ['explosion', 'Explosion'],
    ['hitHurt', 'Choc'],
    ['blipSelect', 'Bip'],
    ['synth', 'Synthé'],
];

/**
 * Slightly change some parameters at random (« muter »), like sfxr's mutate.
 * `random` is injectable for tests.
 */
export function mutateSoundParams(
    params: SoundParams,
    random: () => number = Math.random
): SoundParams {
    const result = { ...params };
    for (const p of PARAMS) {
        if (p.key !== 'sound_vol' && random() < 0.5) {
            result[p.key] = clamp(result[p.key] + (random() * 0.1 - 0.05), p.signed);
        }
    }
    return result;
}

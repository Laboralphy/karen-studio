import { describe, expect, it } from 'vitest';
import { sfxr } from 'jsfxr';
import { newProject } from '@project/defaults';
import {
    defaultSoundParams,
    mutateSoundParams,
    normalizeSoundParams,
    PARAMS,
    PRESETS,
    synthParams,
} from '@project/sound';
import { loadProject, saveProject } from '@project/serialize';
import { SoundPlayer } from '@runtime/SoundPlayer';

describe('sons', () => {
    it('les réglages par défaut couvrent tous les paramètres', () => {
        const p = defaultSoundParams();
        expect(Object.keys(p)).toHaveLength(PARAMS.length + 1); // + wave_type
    });

    it('normalise : bornes, forme d’onde inconnue, clés inconnues', () => {
        const p = normalizeSoundParams({
            wave_type: 9,
            p_base_freq: 5,
            p_freq_ramp: -3,
            pirate: 1,
        });
        expect(p.wave_type).toBe(0);
        expect(p.p_base_freq).toBe(1);
        expect(p.p_freq_ramp).toBe(-1); // signed parameter
        expect(p).not.toHaveProperty('pirate');
    });

    it.each(PRESETS)('le preset %s (%s) donne des réglages valides', (algorithm) => {
        const p = normalizeSoundParams(sfxr.generate(algorithm));
        for (const def of PARAMS) {
            expect(p[def.key]).toBeGreaterThanOrEqual(def.signed ? -1 : 0);
            expect(p[def.key]).toBeLessThanOrEqual(1);
        }
    });

    it('muter change un peu certains réglages, jamais le volume', () => {
        const base = defaultSoundParams();
        let i = 0;
        const random = () => [0.1, 1, 0.9][i++ % 3]; // alternately: mutate by +0.05 / keep
        const m = mutateSoundParams(base, random);
        expect(m.sound_vol).toBe(base.sound_vol);
        expect(m).not.toEqual(base);
        for (const def of PARAMS) {
            expect(Math.abs(m[def.key] - base[def.key])).toBeLessThanOrEqual(0.05 + 1e-9);
        }
    });

    it('connaît la durée des sons même sans sortie audio', () => {
        const player = new SoundPlayer(null);
        const [jump] = newProject().sounds;
        player.prepare([jump]);
        expect(player.duration(jump.id)).toBeGreaterThan(0.05);
        expect(player.duration(jump.id)).toBeLessThan(2);
        expect(player.play(jump.id)).toBeNull();
        expect(sfxr.toBuffer(synthParams(jump.params)).length).toBeGreaterThan(0);
    });

    it('ouvre un fichier de version 1 (sans sons) grâce à la migration', () => {
        const v2 = JSON.parse(saveProject(newProject()));
        const v1 = { ...v2, version: 1 };
        delete v1.sounds;
        const project = loadProject(JSON.stringify(v1));
        expect(project.sounds).toEqual([]);
        expect(project.name).toBe('Mon jeu');
    });
});

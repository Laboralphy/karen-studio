import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadProject } from '@project/serialize';
import { starterAsV3 } from '../helpers/oldFiles';
import { defaultSky, drawSky, normalizeSky, ridgeHeights, type Sky } from '@project/sky';
import { installFakeCanvas, type FakeContext } from '../integration/fakes';

/** Draw a sky on a fake context and return the recorded calls. */
function record(sky: Sky): FakeContext['calls'] {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as FakeContext;
    drawSky(ctx, sky);
    return ctx.calls;
}

/** Tiny squares: stars. */
const stars = (calls: FakeContext['calls']) =>
    calls.filter(
        (c) => c.name === 'fillRect' && (c.args[2] as number) <= 2 && (c.args[3] as number) <= 2
    );

describe('ciel', () => {
    beforeEach(() => {
        installFakeCanvas();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('les crêtes se raccordent : le bord droit rejoint le bord gauche', () => {
        for (const seed of [1, 42, 999]) {
            const h = ridgeHeights(seed, 300, 90, 0.9);
            expect(h[h.length - 1]).toBe(h[0]);
        }
    });

    it('est déterministe : même graine, même dessin ; autre graine, autre dessin', () => {
        const sky = defaultSky();
        expect(record(sky)).toEqual(record(sky));
        expect(record({ ...sky, seed: 2 })).not.toEqual(record(sky));
    });

    it('montre les étoiles la nuit, pas l’après-midi', () => {
        expect(stars(record({ ...defaultSky(), time: 'night' })).length).toBeGreaterThan(100);
        expect(stars(record({ ...defaultSky(), time: 'afternoon' }))).toHaveLength(0);
        expect(stars(record({ ...defaultSky(), time: 'night', stars: false }))).toHaveLength(0);
    });

    it('en couleur unie, remplit simplement l’écran', () => {
        const calls = record({ ...defaultSky(), mode: 'color', color: '#123456' });
        expect(calls).toEqual([{ name: 'fillRect', args: [0, 0, 640, 480] }]);
    });

    it('dessine une mosaïque pour chaque motif', () => {
        for (const pattern of ['checker', 'diamonds', 'stripes', 'dots'] as const) {
            expect(record({ ...defaultSky(), mode: 'mosaic', pattern }).length).toBeGreaterThan(10);
        }
    });

    it('normalise des réglages abîmés', () => {
        const sky = normalizeSky({ mode: 'pirate', parallax: 7, color: 'rouge', clouds: false });
        expect(sky.mode).toBe('landscape');
        expect(sky.parallax).toBe(1);
        expect(sky.color).toBe(defaultSky().color);
        expect(sky.clouds).toBe(false);
    });

    it('migre un fichier v2 : la couleur de fond devient le ciel de chaque niveau', () => {
        const v3 = starterAsV3();
        const v2 = {
            ...v3,
            version: 2,
            settings: { tickRate: 20, backgroundColor: '#abcdef' },
            levels: v3.levels.map(({ sky: _sky, ...l }: { sky: unknown }) => l),
        };
        const project = loadProject(JSON.stringify(v2));
        expect(project.settings).toEqual({ tickRate: 20 });
        expect(project.levels[0].sky.mode).toBe('color');
        expect(project.levels[0].sky.color).toBe('#abcdef');
    });
});

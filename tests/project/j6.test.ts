import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProject } from '@project/defaults';
import {
    createLevel,
    fillRect,
    floodFillTiles,
    markerAt,
    placeMarker,
    resizeLevel,
} from '@project/level';
import { ASSET_PIXELS, TRANSPARENT } from '@project/model';
import { defaultPalette, NES_PALETTE } from '@project/palette';
import { buildSpriteSheet, buildTileset, mirrorFrame } from '@project/render';
import { FILE_VERSION, loadProject, saveProject } from '@project/serialize';
import { generateTexture, MATERIALS } from '@project/textures';
import { installFakeCanvas } from '../integration/fakes';
import { starterAsV3 } from '../helpers/oldFiles';

const palette = defaultPalette();
const DECORATIONS = new Set(['bush', 'cloud', 'ladder']);

describe('générateur de textures NES', () => {
    it('propose au moins 20 matériaux, tous différents', () => {
        expect(MATERIALS.length).toBeGreaterThanOrEqual(20);
        expect(new Set(MATERIALS.map((m) => m.id)).size).toBe(MATERIALS.length);
    });

    it.each(MATERIALS.map((m) => [m.name, m] as const))(
        '%s : images valides et reproductibles',
        (_, m) => {
            const frames = generateTexture(m, 5, palette);
            expect(frames).toHaveLength(m.frames ?? 1);
            for (const f of frames) {
                expect(f).toHaveLength(ASSET_PIXELS);
                expect(f.every((v) => Number.isInteger(v) && v >= 0 && v < 256)).toBe(true);
            }
            expect(generateTexture(m, 5, palette)).toEqual(frames);
            // Only decorations have see-through pixels.
            expect(frames[0].includes(TRANSPARENT)).toBe(DECORATIONS.has(m.id));
        }
    );

    it('les variantes (graines) diffèrent', () => {
        const stone = MATERIALS.find((m) => m.id === 'stone')!;
        expect(generateTexture(stone, 1, palette)).not.toEqual(generateTexture(stone, 2, palette));
    });

    it('les matériaux animés (eau, lave) ont des images différentes', () => {
        for (const id of ['water', 'lava']) {
            const frames = generateTexture(
                MATERIALS.find((m) => m.id === id)!,
                1,
                palette
            );
            expect(frames.length).toBeGreaterThan(1);
            expect(frames[1]).not.toEqual(frames[0]);
        }
    });

    it('utilise exactement les couleurs NES de la palette par défaut', () => {
        const brick = MATERIALS.find((m) => m.id === 'brick')!;
        const used = new Set(generateTexture(brick, 1, palette)[0]);
        const nesColors = new Set(brick.nes.map((i) => NES_PALETTE[i]));
        expect(used.has(TRANSPARENT)).toBe(false);
        expect([...used].every((c) => nesColors.has(palette[c]))).toBe(true);
    });
});

describe('outils de niveau', () => {
    it('remplit un rectangle, quel que soit le sens du tracé, sans déborder', () => {
        const l = createLevel(1, 'n', 4, 3);
        fillRect(l, 2, 2, 1, 0, 7);
        fillRect(l, 3, 2, 9, 9, 5);
        expect(l.tiles).toEqual([0, 7, 7, 0, 0, 7, 7, 0, 0, 7, 7, 5]);
    });

    it('remplit une zone de cases identiques', () => {
        const l = createLevel(1, 'n', 3, 3);
        l.tiles = [0, 1, 0, 0, 1, 0, 1, 1, 0];
        floodFillTiles(l, 0, 0, 4);
        expect(l.tiles).toEqual([4, 1, 0, 4, 1, 0, 1, 1, 0]);
    });

    it('pose, remplace et retrouve des marqueurs', () => {
        const l = createLevel(1, 'n', 5, 5);
        placeMarker(l, 1, 1, 'départ');
        placeMarker(l, 1, 1, 'sortie');
        placeMarker(l, 3, 4, 'ennemi');
        expect(l.markers.map((m) => m.tag)).toEqual(['sortie', 'ennemi']);
        expect(markerAt(l, 3, 4)?.tag).toBe('ennemi');
        expect(new Set(l.markers.map((m) => m.id)).size).toBe(2);
    });

    it('les marqueurs suivent le redimensionnement et disparaissent hors du niveau', () => {
        const l = createLevel(1, 'n', 5, 5);
        placeMarker(l, 1, 4, 'sol');
        placeMarker(l, 4, 0, 'haut');
        resizeLevel(l, 4, 3); // two rows removed at the top, one column on the right
        expect(l.markers).toEqual([expect.objectContaining({ tag: 'sol', col: 1, row: 2 })]);
    });
});

describe('format v4', () => {
    it('enregistre et recharge images, animations et marqueurs', () => {
        const p = newProject();
        placeMarker(p.levels[0], 2, 3, 'départ');
        p.bobs[0].frames.push([...p.bobs[0].frames[0]]);
        expect(loadProject(saveProject(p))).toEqual(p);
        expect(JSON.parse(saveProject(p)).version).toBe(FILE_VERSION);
    });

    it('migre un fichier v3 : une image par asset, pas d’animation ni de marqueur', () => {
        const project = loadProject(JSON.stringify(starterAsV3()));
        expect(project.bobs[0].frames).toHaveLength(1);
        expect(project.sprites[0].frames).toHaveLength(1);
        expect(project.sprites[0].animations).toEqual([]);
        expect(project.levels[0].markers).toEqual([]);
        expect(project.bobs[0].frames[0]).toEqual(newProject().bobs[0].frames[0]);
    });

    it('ignore les numéros d’images d’animation qui n’existent pas', () => {
        const file = JSON.parse(saveProject(newProject()));
        file.sprites[0].animations[1].frames = [0, 7, 2];
        expect(loadProject(JSON.stringify(file)).sprites[0].animations[1].frames).toEqual([0, 2]);
    });
});

describe('planches', () => {
    beforeEach(() => {
        installFakeCanvas();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('place chaque animation sur des cases consécutives, après l’image fixe', () => {
        const heroine = newProject().sprites[0]; // repos: [0], marche: [1, 0, 2, 0]
        const { image, ranges } = buildSpriteSheet(heroine, palette);
        expect(ranges).toEqual([
            { start: 1, count: 1 },
            { start: 2, count: 4 },
        ]);
        expect(image.width).toBe(6 * 32);
    });

    it('donne à chaque BOB animé des tuiles consécutives', () => {
        const bobs = newProject().bobs;
        bobs[1].frames.push(bobs[1].frames[0], bobs[1].frames[0]);
        const { tileOf } = buildTileset(bobs, palette);
        expect([...tileOf.values()]).toEqual([1, 2, 5, 6]);
    });

    it('retourne une image horizontalement', () => {
        const frame = Array.from({ length: ASSET_PIXELS }, (_, i) => i % 32);
        const mirrored = mirrorFrame(frame);
        expect(mirrored.slice(0, 3)).toEqual([31, 30, 29]);
        expect(mirrorFrame(mirrored)).toEqual(frame);
    });
});

import { describe, expect, it } from 'vitest';
import { newProject } from '@project/defaults';
import { createLevel, removeBobFromLevels, resizeLevel } from '@project/level';
import { ASSET_PIXELS, PALETTE_SIZE } from '@project/model';
import { closestColor, defaultPalette } from '@project/palette';
import { decodePixels, encodePixels, floodFill } from '@project/pixels';
import { FILE_VERSION, loadProject, ProjectFileError, saveProject } from '@project/serialize';

describe('palette', () => {
    it('contient 256 couleurs #rrggbb', () => {
        const p = defaultPalette();
        expect(p).toHaveLength(PALETTE_SIZE);
        expect(p.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    });

    it('trouve la couleur la plus proche sans jamais choisir le transparent', () => {
        const p = defaultPalette();
        expect(closestColor(p, '#ffffff')).toBe(p.indexOf('#ffffff'));
        expect(closestColor(p, '#000000')).toBeGreaterThan(0);
    });
});

describe('pixels', () => {
    it('encode et décode en base64 sans perte', () => {
        const pixels = Array.from({ length: ASSET_PIXELS }, (_, i) => i % 256);
        expect(decodePixels(encodePixels(pixels))).toEqual(pixels);
    });

    it('refuse une image de mauvaise taille', () => {
        expect(() => decodePixels(encodePixels([1, 2, 3]))).toThrow();
    });

    it('remplit une zone fermée sans déborder', () => {
        // 4×4 : un mur vertical en colonne 1
        const img = [0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0];
        floodFill(img, 4, 0, 0, 9);
        expect(img).toEqual([9, 5, 0, 0, 9, 5, 0, 0, 9, 5, 0, 0, 9, 5, 0, 0]);
    });
});

describe('niveaux', () => {
    it('agrandit un niveau en gardant le sol en bas', () => {
        const level = createLevel(1, 'n', 2, 2);
        level.tiles = [1, 2, 3, 4];
        resizeLevel(level, 3, 3);
        expect(level.tiles).toEqual([0, 0, 0, 1, 2, 0, 3, 4, 0]);
    });

    it('réduit un niveau en gardant le bas-gauche', () => {
        const level = createLevel(1, 'n', 3, 3);
        level.tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        resizeLevel(level, 2, 2);
        expect(level.tiles).toEqual([4, 5, 7, 8]);
    });

    it('vide les cases d’un BOB supprimé', () => {
        const level = createLevel(1, 'n', 2, 1);
        level.tiles = [3, 4];
        removeBobFromLevels([level], 3);
        expect(level.tiles).toEqual([0, 4]);
    });
});

describe('fichier .karen', () => {
    it('enregistre puis recharge un projet à l’identique', () => {
        const project = newProject();
        expect(loadProject(saveProject(project))).toEqual(project);
    });

    it('indique la version du format', () => {
        expect(JSON.parse(saveProject(newProject())).version).toBe(FILE_VERSION);
    });

    it.each([
        ['un texte qui n’est pas du JSON', 'pas du json', /JSON illisible/],
        ['un autre type de fichier', '{"format":"autre"}', /n'est pas un projet/],
        [
            'un projet plus récent',
            JSON.stringify({ format: 'karen-studio', version: FILE_VERSION + 1 }),
            /plus récente/,
        ],
    ])('refuse %s avec un message clair', (_, text, message) => {
        expect(() => loadProject(text)).toThrow(ProjectFileError);
        expect(() => loadProject(text)).toThrow(message);
    });

    it('refuse une palette abîmée', () => {
        const data = JSON.parse(saveProject(newProject()));
        data.palette = data.palette.slice(0, 10);
        expect(() => loadProject(JSON.stringify(data))).toThrow(/palette/);
    });

    it('vide une case qui désigne un BOB inexistant au lieu d’échouer', () => {
        const data = JSON.parse(saveProject(newProject()));
        data.levels[0].tiles[0] = 999;
        expect(loadProject(JSON.stringify(data)).levels[0].tiles[0]).toBe(0);
    });
});

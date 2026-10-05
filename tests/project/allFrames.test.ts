import { describe, expect, it } from 'vitest';
import { ASSET_PIXELS, ASSET_SIZE } from '@project/model';
import { blankPixels, editAllFrames, flipFrame, floodFill } from '@project/pixels';

/** An image filled with `color`, with one pixel `(x, y)` set to `dot`. */
function image(color: number, dot?: [number, number, number]): number[] {
    const f = new Array<number>(ASSET_PIXELS).fill(color);
    if (dot) f[dot[1] * ASSET_SIZE + dot[0]] = dot[2];
    return f;
}
const at = (f: number[], x: number, y: number) => f[y * ASSET_SIZE + x];

describe('dessiner sur toutes les images', () => {
    // Three different images of a walk animation (the legs move: pixel (5, 30)).
    const frames = [image(0, [5, 30, 7]), image(0, [6, 30, 7]), image(0, [7, 30, 7])];

    it('un pixel dessiné sur une image apparaît au même endroit sur toutes', () => {
        const next = [...frames[1]];
        next[2 * ASSET_SIZE + 3] = 9; // a detail at (3, 2), drawn on image 2
        const result = editAllFrames(frames, 1, next, { kind: 'paint' });
        expect(result.map((f) => at(f, 3, 2))).toEqual([9, 9, 9]);
        // Each image keeps its own differences.
        expect([at(result[0], 5, 30), at(result[1], 6, 30), at(result[2], 7, 30)]).toEqual([
            7, 7, 7,
        ]);
        expect(at(result[0], 6, 30)).toBe(0);
    });

    it('la gomme efface aussi le pixel sur toutes les images', () => {
        const withDetail = frames.map((f) => {
            const c = [...f];
            c[0] = 4;
            return c;
        });
        const next = [...withDetail[0]];
        next[0] = 0;
        expect(editAllFrames(withDetail, 0, next, { kind: 'paint' }).map((f) => f[0])).toEqual([
            0, 0, 0,
        ]);
    });

    it('le remplissage remplit chaque image depuis le même point, en respectant ses contours', () => {
        const next = [...frames[0]];
        floodFill(next, ASSET_SIZE, 0, 0, 3); // the background of image 1
        const result = editAllFrames(frames, 0, next, { kind: 'fill', x: 0, y: 0, color: 3 });
        expect(result.map((f) => at(f, 0, 0))).toEqual([3, 3, 3]);
        // Each image keeps its own leg pixel (not overwritten by image 1's filled area).
        expect([at(result[0], 5, 30), at(result[1], 6, 30), at(result[2], 7, 30)]).toEqual([
            7, 7, 7,
        ]);
        expect(at(result[1], 5, 30)).toBe(3);
    });

    it('le miroir retourne chaque image ; « effacer » vide toutes les images', () => {
        const flipped = editAllFrames(frames, 0, flipFrame(frames[0], true), {
            kind: 'flip',
            horizontal: true,
        });
        expect(flipped.every((f, i) => at(f, ASSET_SIZE - 1 - (5 + i), 30) === 7)).toBe(true);
        const cleared = editAllFrames(frames, 2, blankPixels(), { kind: 'clear' });
        expect(cleared).toEqual([blankPixels(), blankPixels(), blankPixels()]);
    });

    it('ne modifie pas les images d’origine', () => {
        const copy = frames.map((f) => [...f]);
        const next = [...frames[0]];
        next[0] = 8;
        editAllFrames(frames, 0, next, { kind: 'paint' });
        expect(frames).toEqual(copy);
    });

    it('le miroir vertical retourne haut et bas', () => {
        expect(at(flipFrame(image(0, [1, 0, 5]), false), 1, ASSET_SIZE - 1)).toBe(5);
    });
});

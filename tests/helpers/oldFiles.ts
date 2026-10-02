import { newProject } from '@project/defaults';
import { saveProject } from '@project/serialize';

// Old files are loosely shaped JSON.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

/**
 * The starter project as a version 3 file (before multi-image assets and markers):
 * one `pixels` string per BOB / sprite, no animations, no markers, no interface texts.
 */
export function starterAsV3(): Json {
    const file = JSON.parse(saveProject(newProject())) as Json;
    return {
        ...file,
        version: 3,
        bobs: file.bobs.map(({ frames, frameDuration: _d, ...b }: Json) => ({
            ...b,
            pixels: frames[0],
        })),
        sprites: file.sprites.map(({ frames, animations: _a, ...s }: Json) => ({
            ...s,
            pixels: frames[0],
        })),
        levels: file.levels.map(({ markers: _m, ...l }: Json) => l),
        hud: undefined,
    };
}

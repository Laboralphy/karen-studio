/**
 * Karen Studio project model (in memory).
 * The on-disk format (`.karen`, JSON) is handled by `serialize.ts`.
 */

/** Side of an asset, in pixels (BOB and sprites are square). */
export const ASSET_SIZE = 32;
/** Number of pixels in an asset. */
export const ASSET_PIXELS = ASSET_SIZE * ASSET_SIZE;
/** Number of colours in the project palette. */
export const PALETTE_SIZE = 256;
/** Palette index drawn as transparent, in BOB and sprites alike. */
export const TRANSPARENT = 0;
/** Tile value meaning « no BOB here ». */
export const EMPTY_TILE = 0;

/** How a BOB behaves for sprites. */
export type BobCollision = 'air' | 'solid' | 'platform';

/** Background object: a 32×32 level element. */
export interface Bob {
    /** Stable identifier (> 0), referenced by level tiles. */
    id: number;
    name: string;
    collision: BobCollision;
    /** `ASSET_PIXELS` palette indices, row by row. */
    pixels: number[];
}

/** Sprite model: what « créer sprite » instantiates. */
export interface SpriteAsset {
    /** Stable identifier (> 0), referenced by code blocks. */
    id: number;
    name: string;
    /** Tag used by generic events (« sprite de tag … touche … »). */
    tag: string;
    /** `ASSET_PIXELS` palette indices, row by row. */
    pixels: number[];
}

export interface Level {
    /** Stable identifier (> 0). */
    id: number;
    name: string;
    cols: number;
    rows: number;
    /** `cols * rows` BOB ids (or `EMPTY_TILE`), row by row. */
    tiles: number[];
}

export interface ProjectSettings {
    /** Logic ticks per second. */
    tickRate: 20 | 30;
    /** Colour behind the level (CSS colour). */
    backgroundColor: string;
}

export interface KarenProject {
    name: string;
    settings: ProjectSettings;
    /** `PALETTE_SIZE` colours as `#rrggbb`. Index 0 is transparent. */
    palette: string[];
    bobs: Bob[];
    sprites: SpriteAsset[];
    /** The first level is the one the game starts on. */
    levels: Level[];
    /** Blockly workspace (`Blockly.serialization.workspaces.save`), or null when empty. */
    code: object | null;
}

/** Limits of a level, in tiles. */
export const LEVEL_MIN_COLS = 20;
export const LEVEL_MIN_ROWS = 15;
export const LEVEL_MAX_COLS = 400;
export const LEVEL_MAX_ROWS = 60;

/** Return the next free id in a list of `{ id }` objects. */
export function nextId(items: readonly { id: number }[]): number {
    return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

import type { Sky } from './sky';
import type { HudText } from './hud';

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

/** One image of an asset: `ASSET_PIXELS` palette indices, row by row. */
export type Frame = number[];

/** Background object: a 32×32 level element, possibly animated. */
export interface Bob {
    /** Stable identifier (> 0), referenced by level tiles. */
    id: number;
    name: string;
    collision: BobCollision;
    /** At least one image. With several, the BOB is animated (they loop in order). */
    frames: Frame[];
    /** Ticks each image is shown, when animated. */
    frameDuration: number;
}

/** A named animation of a sprite: a sequence of its images. */
export interface SpriteAnimation {
    /** Name used by the « changer l'animation » block. */
    name: string;
    /** Indices (0-based) in the sprite's `frames`, in playing order. */
    frames: number[];
    /** Ticks each image is shown. */
    frameDuration: number;
    /** Loop forever; otherwise stop on the last image (« animation terminée »). */
    loop: boolean;
}

/** Sprite model: what « créer sprite » instantiates. */
export interface SpriteAsset {
    /** Stable identifier (> 0), referenced by code blocks. */
    id: number;
    name: string;
    /** Tag used by generic events (« sprite de tag … touche … »). */
    tag: string;
    /** At least one image; the first one is shown when no animation plays. */
    frames: Frame[];
    /** The first animation (if any) starts when the sprite is created. */
    animations: SpriteAnimation[];
}

/** A point of a level that scripts can refer to by its tag (start, exit, enemy…). */
export interface Marker {
    id: number;
    tag: string;
    col: number;
    row: number;
}

/** Sound effect, synthesised by jsfxr from its parameters. */
export interface SoundAsset {
    /** Stable identifier (> 0), referenced by code blocks. */
    id: number;
    /** Name shown in the « jouer le son » blocks. */
    name: string;
    /** jsfxr parameters (see `sound.ts`). */
    params: Record<string, number>;
}

export interface Level {
    /** Stable identifier (> 0). */
    id: number;
    name: string;
    cols: number;
    rows: number;
    /** `cols * rows` BOB ids (or `EMPTY_TILE`), row by row. */
    tiles: number[];
    /** Background picture, scrolled with parallax. */
    sky: Sky;
    /** Tagged points, invisible in the game. */
    markers: Marker[];
}

export interface ProjectSettings {
    /** Logic ticks per second. */
    tickRate: 20 | 30;
}

export interface KarenProject {
    name: string;
    settings: ProjectSettings;
    /** `PALETTE_SIZE` colours as `#rrggbb`. Index 0 is transparent. */
    palette: string[];
    bobs: Bob[];
    sprites: SpriteAsset[];
    sounds: SoundAsset[];
    /** Texts shown above the game. */
    hud: HudText[];
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

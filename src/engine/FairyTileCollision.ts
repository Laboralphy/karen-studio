import type { FairyFlight } from './FairyFlight.js';

/** Tile collision code: nothing, sprites pass through. */
export const TILE_AIR = 0;
/** Tile collision code: platform, only blocks a sprite falling onto it from above. */
export const TILE_SEMI_SOLID = 1;
/** Tile collision code: wall, blocks from every direction. */
export const TILE_SOLID = 2;

/** Read-only view of a tile grid (implemented by `FairyMatrix`). */
export interface ITileGrid {
    getCols(): number;
    getRows(): number;
    getTileWidth(): number;
    getTileHeight(): number;
    /** Collision code of the tile at grid position `(col, row)` (always in range). */
    getTileCode(col: number, row: number): number;
}

/**
 * Collision box relative to the sprite position (`FairyFlight.vPosition`), in pixels.
 * The box covers `[x + left, x + right)` horizontally and `[y + top, y + bottom)` vertically.
 */
export interface TileBox {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/** Which sides of the box were stopped by a tile during the last resolution. */
export interface TileContacts {
    left: boolean;
    right: boolean;
    top: boolean;
    /** True when the sprite landed on (or is resting on) a solid or semi-solid tile. */
    bottom: boolean;
}

/** Whether the outside of the grid behaves as a wall on each side. */
export interface TileEdges {
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
}

/** Default edges: walls on the left and right, open above (jumps) and below (falls). */
export const DEFAULT_TILE_EDGES: Readonly<TileEdges> = {
    left: true,
    right: true,
    top: false,
    bottom: false,
};

/**
 * Stop a sprite's movement against the solid tiles of a grid.
 *
 * Call it from the sprite's `move` observer: it reads the committed position
 * (`vPosition`, start of the tick) and the candidate one (`vNewPosition`), sweeps the
 * box along X then along Y, and writes the corrected position back to `vNewPosition`.
 * The speed component is zeroed on any blocked axis. Every tile crossed is tested,
 * so fast sprites cannot tunnel through thin walls.
 *
 * - `TILE_SOLID` blocks from every side.
 * - `TILE_SEMI_SOLID` only blocks downward movement, when the box's bottom edge
 *   crosses the tile's top edge (jump through from below, land on top).
 * - Other codes are treated as air (markers, decorations, game-specific codes).
 */
export function resolveTileCollision(
    flight: FairyFlight,
    box: TileBox,
    grid: ITileGrid,
    edges: Readonly<TileEdges> = DEFAULT_TILE_EDGES
): TileContacts {
    const contacts: TileContacts = { left: false, right: false, top: false, bottom: false };
    const tw = grid.getTileWidth();
    const th = grid.getTileHeight();
    const cols = grid.getCols();
    const rows = grid.getRows();

    /** Collision code at `(col, row)`, applying the edge policy outside the grid. */
    const codeAt = (col: number, row: number): number => {
        if (col < 0) return edges.left ? TILE_SOLID : TILE_AIR;
        if (col >= cols) return edges.right ? TILE_SOLID : TILE_AIR;
        if (row < 0) return edges.top ? TILE_SOLID : TILE_AIR;
        if (row >= rows) return edges.bottom ? TILE_SOLID : TILE_AIR;
        return grid.getTileCode(col, row);
    };

    const startX = flight.vPosition.x;
    const startY = flight.vPosition.y;
    let x = flight.vNewPosition.x;
    let y = flight.vNewPosition.y;

    // ── Horizontal sweep (at the starting Y) ─────────────────────────────────
    const rowTop = Math.floor((startY + box.top) / th);
    const rowBottom = Math.ceil((startY + box.bottom) / th) - 1;
    const isWallInColumn = (col: number): boolean => {
        for (let row = rowTop; row <= rowBottom; row++) {
            if (codeAt(col, row) === TILE_SOLID) {
                return true;
            }
        }
        return false;
    };
    if (x > startX) {
        const from = Math.ceil((startX + box.right) / tw);
        const to = Math.ceil((x + box.right) / tw) - 1;
        for (let col = from; col <= to; col++) {
            if (isWallInColumn(col)) {
                x = col * tw - box.right;
                contacts.right = true;
                break;
            }
        }
    } else if (x < startX) {
        const from = Math.floor((startX + box.left) / tw) - 1;
        const to = Math.floor((x + box.left) / tw);
        for (let col = from; col >= to; col--) {
            if (isWallInColumn(col)) {
                x = (col + 1) * tw - box.left;
                contacts.left = true;
                break;
            }
        }
    }

    // ── Vertical sweep (at the resolved X) ───────────────────────────────────
    const colLeft = Math.floor((x + box.left) / tw);
    const colRight = Math.ceil((x + box.right) / tw) - 1;
    const rowBlocks = (row: number, falling: boolean): boolean => {
        for (let col = colLeft; col <= colRight; col++) {
            const code = codeAt(col, row);
            if (code === TILE_SOLID || (falling && code === TILE_SEMI_SOLID)) {
                return true;
            }
        }
        return false;
    };
    if (y > startY) {
        const from = Math.ceil((startY + box.bottom) / th);
        const to = Math.ceil((y + box.bottom) / th) - 1;
        for (let row = from; row <= to; row++) {
            if (rowBlocks(row, true)) {
                y = row * th - box.bottom;
                contacts.bottom = true;
                break;
            }
        }
    } else if (y < startY) {
        const from = Math.floor((startY + box.top) / th) - 1;
        const to = Math.floor((y + box.top) / th);
        for (let row = from; row >= to; row--) {
            if (rowBlocks(row, false)) {
                y = (row + 1) * th - box.top;
                contacts.top = true;
                break;
            }
        }
    }

    if (contacts.left || contacts.right) {
        flight.vNewSpeed.x = 0;
    }
    if (contacts.top || contacts.bottom) {
        flight.vNewSpeed.y = 0;
    }
    flight.vNewPosition.x = x;
    flight.vNewPosition.y = y;
    return contacts;
}

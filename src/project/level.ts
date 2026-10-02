import { EMPTY_TILE, type Level } from './model';

/** Create an empty level of `cols`×`rows` tiles. */
export function createLevel(id: number, name: string, cols: number, rows: number): Level {
    return { id, name, cols, rows, tiles: new Array<number>(cols * rows).fill(EMPTY_TILE) };
}

/** Resize a level in place, keeping the bottom-left content (the ground stays in place). */
export function resizeLevel(level: Level, cols: number, rows: number): void {
    const tiles = new Array<number>(cols * rows).fill(EMPTY_TILE);
    const dy = rows - level.rows;
    for (let y = 0; y < level.rows; y++) {
        const ny = y + dy;
        if (ny < 0 || ny >= rows) {
            continue;
        }
        for (let x = 0; x < Math.min(cols, level.cols); x++) {
            tiles[ny * cols + x] = level.tiles[y * level.cols + x];
        }
    }
    level.cols = cols;
    level.rows = rows;
    level.tiles = tiles;
}

/** Replace every tile using BOB `bobId` with an empty tile (when the BOB is deleted). */
export function removeBobFromLevels(levels: Level[], bobId: number): void {
    for (const level of levels) {
        level.tiles = level.tiles.map((t) => (t === bobId ? EMPTY_TILE : t));
    }
}

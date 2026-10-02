import { EMPTY_TILE, nextId, type Level, type Marker } from './model';
import { defaultSky } from './sky';

/** Create an empty level of `cols`×`rows` tiles. */
export function createLevel(id: number, name: string, cols: number, rows: number): Level {
    return {
        id,
        name,
        cols,
        rows,
        tiles: new Array<number>(cols * rows).fill(EMPTY_TILE),
        sky: defaultSky(),
        markers: [],
    };
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
    // Markers move with the bottom-anchored content.
    level.markers = level.markers.map((m) => ({ ...m, row: m.row + dy }));
    dropOutsideMarkers(level);
}

/** Remove the markers outside the level (after a resize). */
function dropOutsideMarkers(level: Level): void {
    level.markers = level.markers.filter(
        (m) => m.col < level.cols && m.row >= 0 && m.row < level.rows
    );
}

/** Replace every tile using BOB `bobId` with an empty tile (when the BOB is deleted). */
export function removeBobFromLevels(levels: Level[], bobId: number): void {
    for (const level of levels) {
        level.tiles = level.tiles.map((t) => (t === bobId ? EMPTY_TILE : t));
    }
}

/** Fill the rectangle between two cells (any corners, clipped to the level) with `value`. */
export function fillRect(
    level: Level,
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    value: number
): void {
    const [x0, x1] = [Math.max(0, Math.min(c0, c1)), Math.min(level.cols - 1, Math.max(c0, c1))];
    const [y0, y1] = [Math.max(0, Math.min(r0, r1)), Math.min(level.rows - 1, Math.max(r0, r1))];
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            level.tiles[y * level.cols + x] = value;
        }
    }
}

/** Replace the area of identical tiles around `(col, row)` (4 directions) with `value`. */
export function floodFillTiles(level: Level, col: number, row: number, value: number): void {
    const { cols, rows, tiles } = level;
    const target = tiles[row * cols + col];
    if (target === value) return;
    const stack = [row * cols + col];
    while (stack.length > 0) {
        const i = stack.pop()!;
        if (tiles[i] !== target) continue;
        tiles[i] = value;
        const x = i % cols;
        const y = Math.floor(i / cols);
        if (x > 0) stack.push(i - 1);
        if (x < cols - 1) stack.push(i + 1);
        if (y > 0) stack.push(i - cols);
        if (y < rows - 1) stack.push(i + cols);
    }
}

/** The marker on a cell, if any. */
export function markerAt(level: Level, col: number, row: number): Marker | undefined {
    return level.markers.find((m) => m.col === col && m.row === row);
}

/** Put a marker on a cell (replacing the one already there). */
export function placeMarker(level: Level, col: number, row: number, tag: string): Marker {
    level.markers = level.markers.filter((m) => m.col !== col || m.row !== row);
    const marker = { id: nextId(level.markers), tag, col, row };
    level.markers.push(marker);
    return marker;
}

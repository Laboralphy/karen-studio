import { ASSET_SIZE, TRANSPARENT, type Bob, type SpriteAsset } from './model';

/** Parse `#rrggbb` into [r, g, b]. */
function rgb(color: string): [number, number, number] {
    return [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
    ];
}

/**
 * Draw an asset (palette indices) into `ctx` at `(x, y)`, at 1 pixel per pixel.
 * Index `TRANSPARENT` pixels are left untouched.
 */
export function drawAsset(
    ctx: CanvasRenderingContext2D,
    pixels: readonly number[],
    palette: readonly string[],
    x = 0,
    y = 0
): void {
    const image = ctx.createImageData(ASSET_SIZE, ASSET_SIZE);
    const colors = palette.map(rgb);
    for (let i = 0; i < pixels.length; i++) {
        const index = pixels[i];
        if (index === TRANSPARENT) {
            continue;
        }
        const [r, g, b] = colors[index] ?? [255, 0, 255];
        image.data[i * 4] = r;
        image.data[i * 4 + 1] = g;
        image.data[i * 4 + 2] = b;
        image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, x, y);
}

/** Render an asset into a new 32×32 canvas. */
export function assetCanvas(
    pixels: readonly number[],
    palette: readonly string[]
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = ASSET_SIZE;
    canvas.height = ASSET_SIZE;
    drawAsset(canvas.getContext('2d')!, pixels, palette);
    return canvas;
}

/** Number of tiles per row in a generated tileset. */
const TILESET_COLS = 16;

/**
 * Build the level tileset: tile 0 is empty (transparent), then the images of each BOB,
 * consecutively (so an animated BOB is a contiguous range of tiles).
 * Returns the image and the first tile index of each BOB id.
 */
export function buildTileset(
    bobs: readonly Bob[],
    palette: readonly string[]
): { image: HTMLCanvasElement; tileOf: Map<number, number> } {
    const count = 1 + bobs.reduce((n, b) => n + b.frames.length, 0);
    const canvas = document.createElement('canvas');
    canvas.width = TILESET_COLS * ASSET_SIZE;
    canvas.height = Math.ceil(count / TILESET_COLS) * ASSET_SIZE;
    const ctx = canvas.getContext('2d')!;
    const tileOf = new Map<number, number>();
    let tile = 1;
    for (const bob of bobs) {
        tileOf.set(bob.id, tile);
        for (const frame of bob.frames) {
            drawAsset(
                ctx,
                frame,
                palette,
                (tile % TILESET_COLS) * ASSET_SIZE,
                Math.floor(tile / TILESET_COLS) * ASSET_SIZE
            );
            tile++;
        }
    }
    return { image: canvas, tileOf };
}

/** Mirror a 32×32 image horizontally. */
export function mirrorFrame(frame: readonly number[]): number[] {
    const out = new Array<number>(frame.length);
    for (let y = 0; y < ASSET_SIZE; y++) {
        for (let x = 0; x < ASSET_SIZE; x++) {
            out[y * ASSET_SIZE + x] = frame[y * ASSET_SIZE + ASSET_SIZE - 1 - x];
        }
    }
    return out;
}

/** Where each animation lives in a sprite sheet: first cell and number of cells. */
export interface SheetRange {
    start: number;
    count: number;
}

/**
 * Build a sprite sheet, one row: cell 0 is the first image (no animation), then the
 * images of each animation in playing order, so every animation is a contiguous range.
 * With `mirrored`, every image is flipped horizontally (same layout).
 */
export function buildSpriteSheet(
    sprite: Pick<SpriteAsset, 'frames' | 'animations'>,
    palette: readonly string[],
    mirrored = false
): { image: HTMLCanvasElement; ranges: SheetRange[] } {
    const cells: number[] = [0];
    const ranges = sprite.animations.map((a) => {
        const range = { start: cells.length, count: a.frames.length };
        cells.push(...a.frames);
        return range;
    });
    const canvas = document.createElement('canvas');
    canvas.width = cells.length * ASSET_SIZE;
    canvas.height = ASSET_SIZE;
    const ctx = canvas.getContext('2d')!;
    cells.forEach((frameIndex, cell) => {
        const frame = sprite.frames[frameIndex] ?? sprite.frames[0];
        drawAsset(ctx, mirrored ? mirrorFrame(frame) : frame, palette, cell * ASSET_SIZE, 0);
    });
    return { image: canvas, ranges };
}

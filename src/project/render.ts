import { ASSET_SIZE, TRANSPARENT, type Bob } from './model';

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
 * Build the level tileset: tile 0 is empty (transparent), then one tile per BOB.
 * Returns the image and the tile index of each BOB id.
 */
export function buildTileset(
    bobs: readonly Bob[],
    palette: readonly string[]
): { image: HTMLCanvasElement; tileOf: Map<number, number> } {
    const count = bobs.length + 1;
    const canvas = document.createElement('canvas');
    canvas.width = TILESET_COLS * ASSET_SIZE;
    canvas.height = Math.ceil(count / TILESET_COLS) * ASSET_SIZE;
    const ctx = canvas.getContext('2d')!;
    const tileOf = new Map<number, number>();
    bobs.forEach((bob, i) => {
        const tile = i + 1;
        tileOf.set(bob.id, tile);
        drawAsset(
            ctx,
            bob.pixels,
            palette,
            (tile % TILESET_COLS) * ASSET_SIZE,
            Math.floor(tile / TILESET_COLS) * ASSET_SIZE
        );
    });
    return { image: canvas, tileOf };
}

import { ASSET_PIXELS, ASSET_SIZE, TRANSPARENT } from './model';

/** A blank (fully transparent) asset. */
export function blankPixels(): number[] {
    return new Array<number>(ASSET_PIXELS).fill(TRANSPARENT);
}

/** Encode palette indices (0–255) as base64, for the file format. */
export function encodePixels(pixels: readonly number[]): string {
    let binary = '';
    for (const p of pixels) {
        binary += String.fromCharCode(p & 0xff);
    }
    return btoa(binary);
}

/** Decode base64 palette indices; throws if the length is not `expected`. */
export function decodePixels(data: string, expected = ASSET_PIXELS): number[] {
    const binary = atob(data);
    if (binary.length !== expected) {
        throw new Error(`pixels: ${binary.length} octets au lieu de ${expected}`);
    }
    return Array.from(binary, (ch) => ch.charCodeAt(0));
}

/**
 * Flood fill (4-neighbour) from `(x, y)` with `color` on a `size`×`size` image.
 * Modifies `pixels` in place.
 */
export function floodFill(
    pixels: number[],
    size: number,
    x: number,
    y: number,
    color: number
): void {
    const target = pixels[y * size + x];
    if (target === color) {
        return;
    }
    const stack = [y * size + x];
    while (stack.length > 0) {
        const i = stack.pop()!;
        if (pixels[i] !== target) {
            continue;
        }
        pixels[i] = color;
        const px = i % size;
        const py = Math.floor(i / size);
        if (px > 0) stack.push(i - 1);
        if (px < size - 1) stack.push(i + 1);
        if (py > 0) stack.push(i - size);
        if (py < size - 1) stack.push(i + size);
    }
}

/** Mirror a square image horizontally (left ↔ right) or vertically (top ↔ bottom). */
export function flipFrame(
    frame: readonly number[],
    horizontal: boolean,
    size = ASSET_SIZE
): number[] {
    const out = new Array<number>(frame.length);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const sx = horizontal ? size - 1 - x : x;
            const sy = horizontal ? y : size - 1 - y;
            out[y * size + x] = frame[sy * size + sx];
        }
    }
    return out;
}

/** What the pixel editor did to the image. */
export type PixelEdit =
    | { kind: 'paint' }
    | { kind: 'fill'; x: number; y: number; color: number }
    | { kind: 'flip'; horizontal: boolean }
    | { kind: 'clear' };

/**
 * « Dessiner sur toutes les images »: apply to every image of an animation the edit made
 * on image `index` (which became `next`).
 * - paint (pencil, eraser): the pixels that changed on that image get the same new value
 *   on every image; the other pixels of each image are kept;
 * - fill: each image is filled from the same point, following its own outlines;
 * - flip: every image is mirrored; clear: every image is erased.
 */
export function editAllFrames(
    frames: readonly number[][],
    index: number,
    next: number[],
    edit: PixelEdit
): number[][] {
    switch (edit.kind) {
        case 'flip':
            return frames.map((f) => flipFrame(f, edit.horizontal));
        case 'clear':
            return frames.map(() => blankPixels());
        case 'fill':
            return frames.map((f, k) => {
                if (k === index) return next;
                const copy = [...f];
                floodFill(copy, ASSET_SIZE, edit.x, edit.y, edit.color);
                return copy;
            });
        case 'paint': {
            const before = frames[index];
            const changed: number[] = [];
            for (let i = 0; i < next.length; i++) {
                if (next[i] !== before[i]) changed.push(i);
            }
            return frames.map((f, k) => {
                if (k === index) return next;
                const copy = [...f];
                for (const i of changed) copy[i] = next[i];
                return copy;
            });
        }
    }
}

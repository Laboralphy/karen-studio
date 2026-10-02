import { ASSET_PIXELS, TRANSPARENT } from './model';

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

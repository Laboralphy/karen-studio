import type { FairyImage } from './FairyImage.js';

/**
 * Loads and caches images by string ID.
 * Images loaded from a URL are started in parallel; `complete()` polls all of them
 * and returns true only when every registered image has finished loading.
 * Images generated in memory (canvas, bitmap) can be registered with `add` and are
 * immediately ready.
 */
export class FairyImageLoader {
    /** Map from ID to the corresponding image. */
    private _images: Map<string, FairyImage> = new Map();
    /** Cached result of the last `checkComplete` call to avoid re-scanning. */
    private _complete = false;

    /**
     * Begin loading an image from `src` and register it under `id`.
     * @returns A promise that resolves with the loaded `HTMLImageElement`.
     */
    load(id: string, src: string): Promise<HTMLImageElement> {
        this._complete = false;
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.addEventListener('load', () => resolve(img));
            img.addEventListener('error', reject);
            img.src = src;
            this._images.set(id, img);
        });
    }

    /** Register an already available image (canvas, bitmap, loaded image) under `id`. */
    add(id: string, image: FairyImage): void {
        this._images.set(id, image);
    }

    /**
     * Return the image registered under `id`, or null if not found.
     * The image may still be loading; check `complete()` before use.
     */
    get(id: string): FairyImage | null {
        return this._images.get(id) ?? null;
    }

    /**
     * Scan all registered images and return true if every one has finished loading.
     * Updates the internal `_complete` cache.
     */
    checkComplete(): boolean {
        for (const img of this._images.values()) {
            if (img instanceof HTMLImageElement && !img.complete) {
                return (this._complete = false);
            }
        }
        return (this._complete = true);
    }

    /**
     * Return true when all registered images are loaded.
     * Uses the cached value from the last `checkComplete` call to avoid
     * scanning on every tick; re-checks if the cache says incomplete.
     */
    complete(): boolean {
        if (!this._complete) {
            this.checkComplete();
        }
        return this._complete;
    }
}

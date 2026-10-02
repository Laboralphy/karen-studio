import type { IFairyLayer } from './IFairyLayer.js';
import type { FairyImage } from './FairyImage.js';

/**
 * A static background layer that renders a pre-drawn image onto the main canvas.
 * The image is drawn once into an internal off-screen canvas via `setImage`,
 * then composited onto the main canvas on every `render` call.
 *
 * By default the layer is fixed on screen. With `setParallax(fx, fy)` it scrolls at
 * `fx`/`fy` times the camera speed (0 = fixed, 1 = moves with the world), and with
 * `setRepeatX(true)` it is tiled horizontally to fill the screen (sky, mountains…).
 */
export class FairyLayer implements IFairyLayer {
    /** Off-screen canvas holding the baked background image. */
    private _canvas: HTMLCanvasElement;
    /** Rendering context for the off-screen canvas. */
    private _ctx: CanvasRenderingContext2D;
    /** The main canvas context to composite onto. */
    private _finalCtx: CanvasRenderingContext2D | null = null;
    /** Parallax factors applied to the camera position. */
    private _parallaxX = 0;
    private _parallaxY = 0;
    /** Whether the layer is tiled horizontally. */
    private _repeatX = false;
    /** Last camera position received through `setView`. */
    private _viewX = 0;
    private _viewY = 0;

    constructor() {
        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d')!;
    }

    get canvas() {
        return this._canvas;
    }

    /** Resize the off-screen canvas. Call before `setImage`. */
    setSize(w: number, h: number): void {
        this._canvas.width = w;
        this._canvas.height = h;
    }

    /** Bake the image into the off-screen canvas, scaled to fill the layer. */
    setImage(image: FairyImage): void {
        this._ctx.drawImage(image, 0, 0, this._canvas.width, this._canvas.height);
    }

    /** Set the main canvas context onto which the layer will be composited. */
    setContext(ctx: CanvasRenderingContext2D): void {
        this._finalCtx = ctx;
    }

    /** Set how fast the layer scrolls relative to the camera (0 = fixed on screen). */
    setParallax(fx: number, fy: number): void {
        this._parallaxX = fx;
        this._parallaxY = fy;
    }

    /** Tile the layer horizontally so it always covers the screen width. */
    setRepeatX(repeat: boolean): void {
        this._repeatX = repeat;
    }

    /** Camera hook: remember the camera position for the parallax offset. */
    setView(x: number, y: number): void {
        this._viewX = x;
        this._viewY = y;
    }

    /** No per-tick logic for a static background layer. */
    proceed(): void {}

    /** Composite the off-screen canvas onto the main canvas, applying parallax. */
    render(): void {
        const ctx = this._finalCtx!;
        let dx = Math.floor(-this._viewX * this._parallaxX);
        const dy = Math.floor(-this._viewY * this._parallaxY);
        const w = this._canvas.width;
        if (!this._repeatX || w <= 0) {
            ctx.drawImage(this._canvas, dx, dy);
            return;
        }
        dx = ((dx % w) + w) % w;
        if (dx > 0) {
            dx -= w;
        }
        for (let x = dx; x < ctx.canvas.width; x += w) {
            ctx.drawImage(this._canvas, x, dy);
        }
    }
}

import { Fairy } from './Fairy.js';
import type { IFairyLayer } from './IFairyLayer.js';

/**
 * Layer that owns and manages a collection of sprites.
 * `proceed()` runs every tick for all fairies; dead fairies are cleaned up
 * afterwards.  `render()` draws them all in insertion order.
 * New fairies pushed during `proceed()` (e.g. spawned by a collision handler)
 * are picked up in the same tick because `for...of` on the live array sees
 * elements appended after iteration started.
 */
export class Fairies implements IFairyLayer {
    /** All currently live sprites in this layer. */
    private _fairies: Fairy[] = [];
    /** Canvas context shared with every fairy that is linked into this layer. */
    private _ctx: CanvasRenderingContext2D | null = null;
    /** Y coordinate below which any fairy is immediately killed. Defaults to Infinity (off). */
    private _yMax = Infinity;
    /** Scale factor applied to render positions of all fairies in this layer. */
    private _renderScale = 1;
    /** Camera position (world coordinate of the screen's top-left corner). */
    private _viewX = 0;
    private _viewY = 0;

    /** Set the bottom boundary: any fairy whose Y position exceeds this is marked dead. */
    setYMax(yMax: number): void {
        this._yMax = yMax;
    }

    /**
     * Set the render-position scale factor for all fairies in this layer.
     * Call before linking any fairies (already-linked fairies are not updated).
     * Use e.g. `TILE_SIZE / PHYSICAL_TILE_SIZE` when the physics world is larger
     * than the display canvas.
     */
    setRenderScale(scale: number): void {
        this._renderScale = scale;
    }

    /** Set the rendering context that will be passed to each linked fairy. */
    setContext(ctx: CanvasRenderingContext2D): void {
        this._ctx = ctx;
    }

    /**
     * Add a fairy to this layer.
     * Assigns the layer's canvas context to the fairy and appends it to the list.
     */
    linkFairy(fairy: Fairy): void {
        fairy.setContext(this._ctx!);
        fairy.renderScale = this._renderScale;
        this._fairies.push(fairy);
    }

    /**
     * Advance all fairies by one tick, then remove any that are marked dead.
     */
    proceed(): void {
        let hasDeadFairies = false;
        for (const fairy of this._fairies) {
            fairy.proceed();
            if (fairy.oFlight.vPosition.y > this._yMax) {
                fairy.bDead = true;
            }
            hasDeadFairies ||= fairy.bDead;
        }
        if (hasDeadFairies) {
            this._removeDeadFairies();
        }
    }

    /** Camera hook: fairies are drawn shifted by `(-x, -y)`. */
    setView(x: number, y: number): void {
        this._viewX = x;
        this._viewY = y;
    }

    /** Return the live fairies of this layer (do not modify the array). */
    getFairies(): readonly Fairy[] {
        return this._fairies;
    }

    /** Draw all fairies in insertion order, offset by the camera position. */
    render(): void {
        const ctx = this._ctx;
        const shifted = ctx !== null && (this._viewX !== 0 || this._viewY !== 0);
        if (shifted) {
            ctx.save();
            // Same rounding as FairyMatrix.lookAt so sprites never jitter against tiles.
            ctx.translate(Math.floor(-this._viewX), Math.floor(-this._viewY));
        }
        for (const fairy of this._fairies) {
            fairy.render();
        }
        if (shifted) {
            ctx.restore();
        }
    }

    /**
     * Sweep the fairy list from the end, removing dead entries with `splice` so the
     * survivors keep their order (which is also their rendering order).
     * Calls `free()` on each removed fairy to unregister it from the collider.
     */
    private _removeDeadFairies(): void {
        for (let i = this._fairies.length - 1; i >= 0; i--) {
            if (this._fairies[i].bDead) {
                this._fairies[i].free();
                this._fairies.splice(i, 1);
            }
        }
    }
}

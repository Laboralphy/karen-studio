/** Anything with a position that the camera can follow. */
export interface FairyCameraTarget {
    x: number;
    y: number;
}

/**
 * 2D camera: the world-space rectangle shown on screen.
 * `(x, y)` is the world coordinate of the top-left corner of the viewport.
 * When world bounds are set, the camera never shows anything outside the world
 * (if the world is smaller than the viewport, it is pinned to the world origin).
 */
export class FairyCamera {
    /** World X of the viewport's left edge. */
    x = 0;
    /** World Y of the viewport's top edge. */
    y = 0;
    /** Viewport width in pixels. */
    viewWidth: number;
    /** Viewport height in pixels. */
    viewHeight: number;
    /** World width in pixels (Infinity = unbounded). */
    worldWidth = Infinity;
    /** World height in pixels (Infinity = unbounded). */
    worldHeight = Infinity;
    /**
     * Half-size of the dead zone around the viewport centre, in pixels.
     * The camera only moves when the followed target leaves this zone.
     */
    deadZoneX = 0;
    deadZoneY = 0;

    constructor(viewWidth: number, viewHeight: number) {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
    }

    /** Set the world size used to clamp the camera. */
    setWorldSize(w: number, h: number): void {
        this.worldWidth = w;
        this.worldHeight = h;
        this.clamp();
    }

    /** Set the dead zone half-size (see `deadZoneX` / `deadZoneY`). */
    setDeadZone(halfW: number, halfH: number): void {
        this.deadZoneX = halfW;
        this.deadZoneY = halfH;
    }

    /** Move the viewport's top-left corner to `(x, y)`, then clamp. */
    moveTo(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.clamp();
    }

    /** Move the viewport by `(dx, dy)`, then clamp. */
    moveBy(dx: number, dy: number): void {
        this.moveTo(this.x + dx, this.y + dy);
    }

    /** Centre the viewport on `(x, y)`, then clamp. */
    centerOn(x: number, y: number): void {
        this.moveTo(x - this.viewWidth / 2, y - this.viewHeight / 2);
    }

    /**
     * Scroll just enough to keep `target` inside the dead zone around the viewport
     * centre, then clamp. Call once per tick.
     */
    follow(target: FairyCameraTarget): void {
        const cx = this.x + this.viewWidth / 2;
        const cy = this.y + this.viewHeight / 2;
        let dx = 0;
        let dy = 0;
        if (target.x < cx - this.deadZoneX) {
            dx = target.x - (cx - this.deadZoneX);
        } else if (target.x > cx + this.deadZoneX) {
            dx = target.x - (cx + this.deadZoneX);
        }
        if (target.y < cy - this.deadZoneY) {
            dy = target.y - (cy - this.deadZoneY);
        } else if (target.y > cy + this.deadZoneY) {
            dy = target.y - (cy + this.deadZoneY);
        }
        this.moveBy(dx, dy);
    }

    /** Keep the viewport inside the world bounds. */
    clamp(): void {
        this.x = FairyCamera._clampAxis(this.x, this.viewWidth, this.worldWidth);
        this.y = FairyCamera._clampAxis(this.y, this.viewHeight, this.worldHeight);
    }

    private static _clampAxis(pos: number, view: number, world: number): number {
        if (!Number.isFinite(world)) {
            return pos;
        }
        if (world <= view) {
            return 0;
        }
        return Math.min(Math.max(pos, 0), world - view);
    }
}

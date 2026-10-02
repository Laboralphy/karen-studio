/**
 * Fixed-timestep clock.
 * Converts real elapsed time into a whole number of logic ticks at a constant rate
 * (e.g. 30 ticks per second), whatever the display refresh rate.
 * Leftover time is carried to the next call; when the program stalls (tab hidden,
 * debugger, slow frame), at most `maxCatchUp` ticks are returned and the rest of
 * the backlog is dropped so the game slows down instead of fast-forwarding.
 */
export class FairyTicker {
    /** Duration of one tick in milliseconds. */
    private _tickMs = 1000 / 30;
    /** Time accumulated but not yet converted into ticks. */
    private _accumulator = 0;
    /** Timestamp of the previous `advance` call, or null before the first one. */
    private _last: number | null = null;
    /** Maximum number of ticks returned by a single `advance` call. */
    maxCatchUp = 5;

    constructor(fps = 30) {
        this.setRate(fps);
    }

    /** Set the number of ticks per second. */
    setRate(fps: number): void {
        if (!(fps > 0)) {
            throw new Error(`FairyTicker: invalid tick rate ${fps}`);
        }
        this._tickMs = 1000 / fps;
    }

    /** Return the number of ticks per second. */
    getRate(): number {
        return 1000 / this._tickMs;
    }

    /** Forget the accumulated time; the next `advance` call restarts the clock. */
    reset(): void {
        this._accumulator = 0;
        this._last = null;
    }

    /**
     * Feed the current time (ms, e.g. `performance.now()`) and return how many ticks
     * must be run now. The first call only starts the clock and returns 0.
     */
    advance(now: number): number {
        if (this._last === null) {
            this._last = now;
            return 0;
        }
        this._accumulator += Math.max(0, now - this._last);
        this._last = now;
        // The epsilon absorbs floating-point drift (e.g. 1000/144 summed 144 times).
        let ticks = Math.floor((this._accumulator + 1e-6) / this._tickMs);
        this._accumulator -= ticks * this._tickMs;
        if (ticks > this.maxCatchUp) {
            ticks = this.maxCatchUp;
            this._accumulator = 0;
        }
        return ticks;
    }
}

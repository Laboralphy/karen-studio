import { vi } from 'vitest';

/** One recorded call on a fake 2D context. */
export interface CtxCall {
    name: string;
    args: unknown[];
}

/** Fake `CanvasRenderingContext2D`: records every method call, accepts any property. */
export type FakeContext = CanvasRenderingContext2D & { calls: CtxCall[] };

/** Methods returning an object the caller uses afterwards. */
const RETURNS: Record<string, () => unknown> = {
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    measureText: () => ({ width: 0 }),
};

/** Methods whose result depends on their arguments. */
const COMPUTED: Record<string, (...args: never[]) => unknown> = {
    createImageData: (w: number, h: number) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4),
    }),
};

function createFakeContext(canvas: HTMLCanvasElement): FakeContext {
    const state: Record<string | symbol, unknown> = { canvas, calls: [] as CtxCall[] };
    return new Proxy(state, {
        get(target, prop) {
            if (prop in target) {
                return target[prop];
            }
            if (typeof prop !== 'string') {
                return undefined;
            }
            return (...args: unknown[]) => {
                (target.calls as CtxCall[]).push({ name: prop, args });
                return COMPUTED[prop] ? COMPUTED[prop](...(args as never[])) : RETURNS[prop]?.();
            };
        },
        set(target, prop, value) {
            target[prop] = value;
            return true;
        },
    }) as unknown as FakeContext;
}

/**
 * Give every canvas a recording fake 2D context (happy-dom has none).
 * Returns a lookup to get the fake context of a given canvas.
 */
export function installFakeCanvas(): (canvas: HTMLCanvasElement) => FakeContext {
    const contexts = new WeakMap<HTMLCanvasElement, FakeContext>();
    const get = (canvas: HTMLCanvasElement): FakeContext => {
        let ctx = contexts.get(canvas);
        if (!ctx) {
            ctx = createFakeContext(canvas);
            contexts.set(canvas, ctx);
        }
        return ctx;
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
        this: HTMLCanvasElement
    ) {
        return get(this);
    } as unknown as HTMLCanvasElement['getContext']);
    return get;
}

/** Manual `requestAnimationFrame`: the test decides when each frame happens. */
export interface FakeClock {
    /** Run the pending animation frame at time `now` (ms). */
    frame(now: number): void;
    /** Run `n` frames spaced so that each one triggers exactly one tick at `fps`. */
    ticks(n: number, fps?: number): void;
    /** True when the engine has requested another frame. */
    readonly pending: boolean;
}

export function installFakeClock(): FakeClock {
    let callback: FrameRequestCallback | null = null;
    let now = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        callback = cb;
        return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
        callback = null;
    });
    const clock: FakeClock = {
        frame(t: number) {
            now = t;
            const cb = callback;
            callback = null;
            cb?.(t);
        },
        ticks(n: number, fps = 30) {
            for (let i = 0; i < n; i++) {
                clock.frame(now + 1000 / fps);
            }
        },
        get pending() {
            return callback !== null;
        },
    };
    return clock;
}

/** Dispatch a keydown/keyup with a legacy `keyCode` on `target`. */
export function key(target: EventTarget, type: 'keydown' | 'keyup', keyCode: number): void {
    target.dispatchEvent(new KeyboardEvent(type, { keyCode, bubbles: true } as KeyboardEventInit));
}

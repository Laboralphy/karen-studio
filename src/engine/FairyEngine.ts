import { FairyImageLoader } from './FairyImageLoader.js';
import { FairyInputState } from './FairyInputState.js';
import { FairySequencer } from './FairySequencer.js';
import { FairyCollider } from './FairyCollision.js';
import { FairyMatrix } from './FairyMatrix.js';
import { FairyLayer } from './FairyLayer.js';
import { Fairies } from './Fairies.js';
import { Fairy } from './Fairy.js';
import { FairyTicker } from './FairyTicker.js';
import type { FairyCamera } from './FairyCamera.js';
import type { FairyImage } from './FairyImage.js';
import type { IFairyLayer } from './IFairyLayer.js';

/**
 * Base engine class.  Subclasses override the four state hooks to implement a game.
 *
 * **Lifecycle states (managed by `FairySequencer`):**
 * 1. `stateEngineInitializing` – one-shot synchronous setup; kicks off resource loading.
 * 2. `stateResourceLoading`    – polls `FairyImageLoader` until all assets are ready.
 * 3. `stateGameInitializing`   – one-shot; builds layers, creates sprites, loads level.
 * 4. `stateGameRunning`        – called every tick; runs game logic then `proceed` on every layer.
 *
 * **Timing:** the logic runs at a fixed rate (`setTickRate`, 30 ticks/s by default)
 * whatever the display refresh rate, driven by a `FairyTicker` fed from
 * `requestAnimationFrame`. After the ticks due for an animation frame have run,
 * every layer is rendered once.
 *
 * **Camera:** when a `FairyCamera` is attached (`setCamera`), its position is passed to
 * every layer implementing `setView` just before rendering.
 */
export class FairyEngine {
    /** Manages all loaded sprite-sheet images. */
    protected _images = new FairyImageLoader();
    /** Current keyboard and mouse input snapshot. */
    protected _input = new FairyInputState();
    /** Spatial hash collider shared by all sprite layers. */
    protected _collider: FairyCollider | null = null;

    /** The game canvas element. */
    private _canvas: HTMLCanvasElement | null = null;
    /** 2D rendering context for the main canvas. */
    private _ctx: CanvasRenderingContext2D | null = null;
    /** Ordered list of renderable/tickable layers (background, tiles, sprites…). */
    private _layers: IFairyLayer[] = [];
    /** State machine that drives the engine lifecycle. */
    private _seq = new FairySequencer();
    /** `requestAnimationFrame` handle, or null when the loop is stopped. */
    private _rafId: number | null = null;
    /** Fixed-timestep clock converting elapsed time into logic ticks. */
    private _ticker = new FairyTicker(30);
    /** True when at least one tick ran since the last render. */
    private _needsRender = false;
    /** Optional camera whose position is forwarded to layers before rendering. */
    private _camera: FairyCamera | null = null;
    /** Element (or window) receiving keyboard events. */
    private _inputTarget: HTMLElement | Window = window;

    /** Called when the game loop stops because of an uncaught error. */
    onError: ((error: unknown) => void) | null = null;

    /** Bound input handlers — stored so they can be removed by `destroy()`. */
    private _onKeyDown = (e: Event) => this._handleKey(e as KeyboardEvent, true);
    private _onKeyUp = (e: Event) => this._handleKey(e as KeyboardEvent, false);
    private _onBlur = () => this._input.releaseAll();
    private _onMouseMove = (e: MouseEvent) => this._input.setMouseXY(e.clientX, e.clientY);
    private _onMouseDown = (e: MouseEvent) => {
        this._input.setMouseButton(e.button, true);
        return false;
    };
    private _onMouseUp = (e: MouseEvent) => {
        this._input.setMouseButton(e.button, false);
        return false;
    };

    constructor() {
        this._seq.addState('stateEngineInitializing', () => this._doEngineInit());
        this._seq.addState('stateResourceLoading', () => this._doResourceLoading());
        this._seq.addState('stateGameInitializing', () => this._doGameInit());
        this._seq.addState('stateGameRunning', () => this._doGameRunning());
    }

    /** Allow subclasses to register additional FSM states. */
    protected addState(name: string, handler: () => string | null | undefined): void {
        this._seq.addState(name, handler);
    }

    // ── State machine internals ──────────────────────────────────────────────

    /** Run `stateEngineInitializing`, fire off async resource loading, advance to loading state. */
    private _doEngineInit(): string {
        this.stateEngineInitializing();
        this.stateResourceLoading(); // fire-and-forget async loading
        return 'stateResourceLoading';
    }

    /** Poll the image loader; advance to game init once all assets are ready. */
    private _doResourceLoading(): string | null {
        return this._images.complete() ? 'stateGameInitializing' : null;
    }

    /** Run `stateGameInitializing` then advance to the running state. */
    private _doGameInit(): string {
        this.stateGameInitializing();
        return 'stateGameRunning';
    }

    /** Run `stateGameRunning`, advance all layers, then check for a state transition. */
    private _doGameRunning(): string | null {
        const next = this.stateGameRunning() ?? null;
        for (const layer of this._layers) {
            layer.proceed();
        }
        this._needsRender = true;
        return next;
    }

    // ── Overridable hooks (subclasses implement these) ───────────────────────

    /** Called once during engine initialisation. Override to do early setup. */
    protected stateEngineInitializing(): void {}

    /**
     * Called once to kick off asset loading.
     * Override and call `this.loadImage(...)` for each required image.
     * May be async; the engine polls `FairyImageLoader.complete()` each tick.
     */
    protected stateResourceLoading(): void | Promise<void> {}

    /** Called once when assets are ready. Override to build layers and sprites. */
    protected stateGameInitializing(): void {}

    /**
     * Called every tick while the game is running.
     * Override to implement per-frame game logic (input, AI, scoring…).
     * Return a non-empty string to transition the engine to a different state;
     * return null or undefined to keep running.
     */
    protected stateGameRunning(): string | null | undefined {
        return null;
    }

    // ── Canvas ───────────────────────────────────────────────────────────────

    /** Assign the `<canvas>` element and extract its 2D context. */
    setCanvas(canvas: HTMLCanvasElement): void {
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d')!;
    }

    /** Return the canvas element. */
    getCanvas(): HTMLCanvasElement {
        return this._canvas!;
    }

    // ── Timing, camera, input target ─────────────────────────────────────────

    /** Set the number of logic ticks per second (e.g. 20 or 30). */
    setTickRate(fps: number): void {
        this._ticker.setRate(fps);
    }

    /** Return the number of logic ticks per second. */
    getTickRate(): number {
        return this._ticker.getRate();
    }

    /** Attach (or detach with null) the camera used to scroll the layers. */
    setCamera(camera: FairyCamera | null): void {
        this._camera = camera;
    }

    /** Return the attached camera, or null. */
    getCamera(): FairyCamera | null {
        return this._camera;
    }

    /**
     * Choose which element receives keyboard events (default: `window`).
     * With an element (it needs a `tabindex`), keys only drive the game while it has
     * focus, and keys that would scroll the page (arrows, space…) are swallowed.
     * Call before `start()`.
     */
    setInputTarget(target: HTMLElement | Window): void {
        this._inputTarget = target;
    }

    /** Throw if `setCanvas` has not been called yet. */
    private _requireCanvas(): void {
        if (!this._ctx) {
            throw new Error('FairyEngine: call setCanvas() first!');
        }
    }

    // ── Layer factories ──────────────────────────────────────────────────────

    /** Remove all layers (useful when transitioning between game states). */
    clearLayers(): void {
        this._layers = [];
    }

    /** Create and configure the shared spatial hash collider. */
    createCollider(cols: number, rows: number, sectorW: number, sectorH: number): void {
        this._collider = new FairyCollider();
        this._collider.setSize(cols, rows, sectorW, sectorH);
    }

    /**
     * Create a static background layer from a pre-loaded image and add it to the stack.
     * The image is baked into an off-screen canvas and composited every render frame.
     */
    createBackgroundLayer(imageId: string, w: number, h: number): FairyLayer {
        this._requireCanvas();
        const layer = new FairyLayer();
        layer.setSize(w, h);
        layer.setImage(this._images.get(imageId)!);
        layer.setContext(this._ctx!);
        this._layers.push(layer);
        return layer;
    }

    /**
     * Create a tile-map layer and add it to the stack.
     * The returned `FairyMatrix` can be populated via `FairyLevelBuilder`.
     */
    createMatrixLayer(
        imageId: string,
        cols: number,
        rows: number,
        tileW: number,
        tileH: number
    ): FairyMatrix {
        this._requireCanvas();
        const matrix = new FairyMatrix();
        matrix.setRenderingCanvas(this._canvas!);
        matrix.setImage(this._images.get(imageId)!);
        matrix.setSize(cols, rows, tileW, tileH);
        this._layers.push(matrix);
        return matrix;
    }

    /**
     * Create an empty sprite layer and add it to the stack.
     * Use `createFairy` to populate it.
     */
    createFairyLayer(): Fairies {
        this._requireCanvas();
        const fairies = new Fairies();
        fairies.setContext(this._ctx!);
        this._layers.push(fairies);
        return fairies;
    }

    /**
     * Create a simple canvas, good for displayin anything that is not a sprite or tileset
     */
    createCanvasLayer(): FairyLayer {
        this._requireCanvas();
        const canvas = this._canvas!;
        const layer = new FairyLayer();
        layer.setSize(canvas.width, canvas.height);
        layer.setContext(this._ctx!);
        this._layers.push(layer);
        return layer;
    }

    /**
     * Instantiate a sprite, attach resources, and add it to `layer`.
     * The return type matches the concrete subtype passed as `fairy`, so the caller
     * retains access to subclass-specific properties and the correct `oObservatory`
     * event map without needing a cast.
     * @param layer   - The `Fairies` layer to add the sprite to.
     * @param imageId - Key of the pre-loaded sprite sheet image.
     * @param fairy   - The sprite instance (defaults to a plain `Fairy`).
     */
    createFairy<T extends Fairy>(layer: Fairies, imageId: string, fairy: T = new Fairy() as T): T {
        fairy.setImage(this._images.get(imageId)!);
        if (this._collider) {
            fairy.setCollider(this._collider);
        }
        layer.linkFairy(fairy);
        return fairy;
    }

    /** Register an image generated in memory (canvas, bitmap) under `id`. */
    addImage(id: string, image: FairyImage): void {
        this._images.add(id, image);
    }

    /**
     * Begin loading a sprite-sheet image asynchronously.
     * @param src - URL of the image file.
     * @param id  - Key used to retrieve the image later via `_images.get(id)`.
     */
    loadImage(src: string, id: string): Promise<HTMLImageElement> {
        return this._images.load(id, src);
    }

    // ── Main loop (requestAnimationFrame) ────────────────────────────────────

    /** Start the `requestAnimationFrame` loop and bind input event listeners. */
    start(): void {
        this._bindInputEvents();
        this._ticker.reset();
        const loop = (now: number) => {
            try {
                const ticks = this._ticker.advance(now);
                for (let i = 0; i < ticks; i++) {
                    this._seq.tick();
                    this._input.endTick();
                }
                if (this._needsRender) {
                    this._renderFrame();
                    this._needsRender = false;
                }
            } catch (e) {
                console.error(e);
                this._rafId = null;
                this.onError?.(e);
                return; // stop on error
            }
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    /** Cancel the animation frame loop. */
    stop(): void {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    /**
     * Stop the loop, remove all input event listeners, and drop all layers.
     * Call this when discarding the engine so the instance can be garbage collected.
     */
    destroy(): void {
        this.stop();
        this._inputTarget.removeEventListener('keydown', this._onKeyDown);
        this._inputTarget.removeEventListener('keyup', this._onKeyUp);
        this._inputTarget.removeEventListener('blur', this._onBlur);
        if (this._canvas) {
            this._canvas.removeEventListener('mousemove', this._onMouseMove);
            this._canvas.removeEventListener(
                'mousedown',
                this._onMouseDown as unknown as EventListener
            );
            this._canvas.removeEventListener(
                'mouseup',
                this._onMouseUp as unknown as EventListener
            );
        }
        this.clearLayers();
    }

    /** Clear the canvas and draw every layer, passing the camera position first. */
    private _renderFrame(): void {
        const ctx = this._ctx;
        if (ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        const cam = this._camera;
        for (const layer of this._layers) {
            if (cam) {
                layer.setView?.(cam.x, cam.y);
            }
            layer.render();
        }
    }

    // ── Input handling ────────────────────────────────────────────────────────

    /** Keys that scroll the page by default: space, page up/down, end, home, arrows. */
    private static readonly _SCROLL_KEYS = new Set([32, 33, 34, 35, 36, 37, 38, 39, 40]);

    /** Record a key transition; swallow scrolling keys when bound to an element. */
    private _handleKey(e: KeyboardEvent, down: boolean): void {
        const key = e.keyCode || e.which;
        if (this._inputTarget !== window && FairyEngine._SCROLL_KEYS.has(key)) {
            e.preventDefault();
        }
        this._input.setKeyState(key, down);
    }

    /** Attach keyboard listeners to the input target and mouse listeners to the canvas. */
    private _bindInputEvents(): void {
        this._inputTarget.addEventListener('keydown', this._onKeyDown);
        this._inputTarget.addEventListener('keyup', this._onKeyUp);
        this._inputTarget.addEventListener('blur', this._onBlur);

        if (this._canvas) {
            this._canvas.addEventListener('mousemove', this._onMouseMove);
            this._canvas.addEventListener(
                'mousedown',
                this._onMouseDown as unknown as EventListener
            );
            this._canvas.addEventListener('mouseup', this._onMouseUp as unknown as EventListener);
        }
    }
}

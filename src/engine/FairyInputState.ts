/** Snapshot of the mouse cursor state. */
export interface MouseState {
    /** Cursor X position in client (viewport) coordinates. */
    x: number;
    /** Cursor Y position in client (viewport) coordinates. */
    y: number;
    /** Button states indexed by button number (0 = primary, 1 = middle, 2 = secondary). */
    b: boolean[];
}

/**
 * Flat snapshot of all keyboard and mouse input.
 * Updated directly by the engine's `keydown`/`keyup`/`mousemove`/`mousedown`/`mouseup`
 * event listeners.  Game code reads state via `getKeyState`; it can also
 * consume a key press by calling `setKeyState(key, false)` to prevent
 * auto-repeat while the key is held.
 *
 * Besides the held state, key *transitions* are latched until the end of the tick
 * (`isKeyPressed` / `isKeyReleased`), so a tap shorter than one tick is never missed.
 * The engine calls `endTick()` after each logic tick to clear them.
 */
export class FairyInputState {
    /** Key-down state for key codes 0–255. */
    private _keys: boolean[] = new Array(256).fill(false);
    /** Keys that went down since the last `endTick`. */
    private _pressed: boolean[] = new Array(256).fill(false);
    /** Keys that went up since the last `endTick`. */
    private _released: boolean[] = new Array(256).fill(false);
    /** Current mouse cursor and button state. */
    private _mouse: MouseState = { x: 0, y: 0, b: [false, false, false, false] };

    /** Return true if the key with the given key code is currently pressed. */
    getKeyState(key: number): boolean {
        return this._keys[key] ?? false;
    }

    /** Set the pressed/released state for the given key code. */
    setKeyState(key: number, state: boolean): void {
        const was = this._keys[key] ?? false;
        if (state && !was) {
            this._pressed[key] = true;
        } else if (!state && was) {
            this._released[key] = true;
        }
        this._keys[key] = state;
    }

    /** Return true if the key went down during the current tick (auto-repeat ignored). */
    isKeyPressed(key: number): boolean {
        return this._pressed[key] ?? false;
    }

    /** Return true if the key went up during the current tick. */
    isKeyReleased(key: number): boolean {
        return this._released[key] ?? false;
    }

    /** Release every held key (e.g. when the game loses focus) so none stays stuck. */
    releaseAll(): void {
        for (let k = 0; k < this._keys.length; k++) {
            if (this._keys[k]) {
                this.setKeyState(k, false);
            }
        }
    }

    /** Clear the per-tick pressed/released latches. Called by the engine after each tick. */
    endTick(): void {
        this._pressed.fill(false);
        this._released.fill(false);
    }

    /** Return the full mouse state object. */
    getMouseState(): MouseState {
        return this._mouse;
    }

    /** Update the mouse cursor position. */
    setMouseXY(x: number, y: number): void {
        this._mouse.x = x;
        this._mouse.y = y;
    }

    /** Set the pressed/released state for the given mouse button. */
    setMouseButton(button: number, state: boolean): void {
        this._mouse.b[button] = state;
    }
}

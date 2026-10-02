/**
 * Undo / redo history of serialised states (strings).
 * `record` adds a state when it differs from the current one; recording after an undo
 * discards the redo branch. The oldest states are dropped beyond `limit`.
 */
export class UndoHistory {
    private _past: string[] = [];
    private _future: string[] = [];
    private _current = '';

    constructor(readonly limit = 100) {}

    /** Forget everything; `state` becomes the starting point. */
    reset(state: string): void {
        this._past = [];
        this._future = [];
        this._current = state;
    }

    /** Record a new state. Returns false if it equals the current one (nothing to undo). */
    record(state: string): boolean {
        if (state === this._current) {
            return false;
        }
        this._past.push(this._current);
        if (this._past.length > this.limit) {
            this._past.shift();
        }
        this._current = state;
        this._future = [];
        return true;
    }

    get canUndo(): boolean {
        return this._past.length > 0;
    }

    get canRedo(): boolean {
        return this._future.length > 0;
    }

    /** Step back; returns the state to restore, or null when there is nothing to undo. */
    undo(): string | null {
        const previous = this._past.pop();
        if (previous === undefined) {
            return null;
        }
        this._future.push(this._current);
        this._current = previous;
        return previous;
    }

    /** Step forward again; returns the state to restore, or null. */
    redo(): string | null {
        const next = this._future.pop();
        if (next === undefined) {
            return null;
        }
        this._past.push(this._current);
        this._current = next;
        return next;
    }
}

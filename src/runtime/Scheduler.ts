/**
 * A script coroutine. It runs until its next `yield`:
 * - `yield` (or `yield 1`) → resume at the next tick;
 * - `yield n`              → resume in `n` ticks (the « attendre » block).
 * Generated block code yields at the end of every loop iteration, like Scratch,
 * so a « répéter indéfiniment » never freezes the game.
 */
export type ScriptCoroutine = Generator<number | void, void, void>;

/** A running script, as returned by `Scheduler.spawn`. */
export interface ScriptThread {
    /** Human-readable name used in error messages (e.g. « quand la touche ↑ est pressée »). */
    readonly name: string;
    /** True once the script has finished, was stopped, or crashed. */
    readonly done: boolean;
}

/** Thrown inside a script that runs too long without yielding (infinite loop without pause). */
export class ScriptStepLimitError extends Error {
    constructor(threadName: string) {
        super(`Le script « ${threadName} » ne rend jamais la main : boucle infinie sans pause ?`);
        this.name = 'ScriptStepLimitError';
    }
}

/** Internal thread state. */
class Thread implements ScriptThread {
    done = false;
    /** Ticks to skip before resuming. */
    sleep = 0;
    /** Loop iterations counted by `guard()` during the current resume. */
    steps = 0;

    constructor(
        readonly name: string,
        readonly coroutine: ScriptCoroutine
    ) {}
}

/**
 * Cooperative scheduler running script coroutines once per game tick.
 *
 * Threads are resumed in creation order. A thread spawned during a tick (for example
 * by an event fired by another script) starts running in that same tick.
 * An error thrown by a script stops that script only, and is reported via `onError`.
 */
export class Scheduler {
    /** Live threads, in creation order. */
    private _threads: Thread[] = [];
    /** Thread currently being resumed, or null between resumes. */
    private _current: Thread | null = null;

    /** Maximum loop iterations (`guard()` calls) a thread may do before its next yield. */
    maxStepsPerResume = 100_000;

    /** Called when a script throws (including `ScriptStepLimitError`). */
    onError: ((thread: ScriptThread, error: unknown) => void) | null = null;

    /** Start a new script; it first runs at the current or next `tick()`. */
    spawn(name: string, coroutine: ScriptCoroutine): ScriptThread {
        const thread = new Thread(name, coroutine);
        this._threads.push(thread);
        return thread;
    }

    /** Number of live threads. */
    get count(): number {
        return this._threads.length;
    }

    /** Resume every live thread once (or count down its wait). */
    tick(): void {
        // Index loop on purpose: threads spawned during this tick are run too.
        for (let i = 0; i < this._threads.length; i++) {
            const thread = this._threads[i];
            if (thread.done) {
                continue;
            }
            if (thread.sleep > 0) {
                thread.sleep--;
                continue;
            }
            this._resume(thread);
        }
        this._threads = this._threads.filter((t) => !t.done);
    }

    /**
     * Count one loop iteration of the current script; throw `ScriptStepLimitError`
     * when it exceeds `maxStepsPerResume`. Generated code calls it in every loop body.
     */
    guard(): void {
        const thread = this._current;
        if (thread && ++thread.steps > this.maxStepsPerResume) {
            throw new ScriptStepLimitError(thread.name);
        }
    }

    /** Stop one script (its `finally` blocks run). */
    kill(handle: ScriptThread): void {
        const thread = handle as Thread;
        if (!thread.done) {
            thread.done = true;
            this._close(thread);
        }
    }

    /** Stop every script. */
    stopAll(): void {
        for (const thread of this._threads) {
            this.kill(thread);
        }
        this._threads = [];
    }

    private _resume(thread: Thread): void {
        this._current = thread;
        thread.steps = 0;
        try {
            const result = thread.coroutine.next();
            if (result.done) {
                thread.done = true;
            } else {
                const ticks = typeof result.value === 'number' ? Math.floor(result.value) : 1;
                thread.sleep = Math.max(1, ticks) - 1;
            }
        } catch (error) {
            thread.done = true;
            this.onError?.(thread, error);
        } finally {
            this._current = null;
        }
    }

    /** Run the coroutine's `finally` blocks; errors raised there are reported, not thrown. */
    private _close(thread: Thread): void {
        if (thread === this._current) {
            // A script stopping itself: its generator is running and cannot be closed;
            // being marked done, it will simply never be resumed again.
            return;
        }
        try {
            thread.coroutine.return();
        } catch (error) {
            this.onError?.(thread, error);
        }
    }
}

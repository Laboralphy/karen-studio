import { compileProject } from '../blocks/compile';
import type { KarenProject } from '../project/model';
import { ProjectGame } from './ProjectGame';
import { SoundPlayer } from './SoundPlayer';
import { HudLayer } from './HudLayer';

let sharedContext: AudioContext | null | undefined;

/** One audio context for the whole application (null when WebAudio is unavailable). */
function audioContext(): AudioContext | null {
    if (sharedContext === undefined) {
        sharedContext = typeof AudioContext === 'undefined' ? null : new AudioContext();
    }
    return sharedContext;
}

/**
 * Runs a project in the editor's preview canvas.
 * `start` always builds a brand-new engine from a snapshot of the project, so editing
 * while the game runs has no effect, and « Stop » then « Démarrer » restarts cleanly.
 */
export class GameRuntime {
    private _game: ProjectGame | null = null;
    private _hud: HudLayer | null = null;

    /** Called when the game cannot start or stops because of an error. */
    onError: ((message: string) => void) | null = null;
    /** Called when a script stops because of an error (the game keeps running). */
    onScriptError: ((message: string) => void) | null = null;

    /** True while a game is running. */
    get running(): boolean {
        return this._game !== null;
    }

    /** The running game, if any (for tests and debugging). */
    get game(): ProjectGame | null {
        return this._game;
    }

    /**
     * Start `project` on `canvas`. Keyboard input is read from `inputTarget`
     * (a focusable element), so typing elsewhere in the editor does not drive the game.
     * The interface texts are put in `hudHost` (an element above the canvas), if given.
     * Returns false (and calls `onError`) when the project cannot be started.
     */
    start(
        canvas: HTMLCanvasElement,
        inputTarget: HTMLElement,
        project: KarenProject,
        hudHost?: HTMLElement
    ): boolean {
        this.stop();
        const snapshot = structuredClone(project);
        let code: string;
        try {
            code = compileProject(snapshot);
        } catch (e) {
            this.onError?.(`Les blocs n'ont pas pu être compilés : ${(e as Error).message}`);
            return false;
        }
        const context = audioContext();
        void context?.resume();
        this._hud = hudHost ? new HudLayer(hudHost, snapshot.hud) : null;
        const game = new ProjectGame(
            snapshot,
            code,
            new SoundPlayer(context),
            this._hud ?? undefined
        );
        game.setCanvas(canvas);
        game.setInputTarget(inputTarget);
        game.onScriptError = (message) => this.onScriptError?.(message);
        game.onError = (error) => {
            this.stop();
            this.onError?.(error instanceof Error ? error.message : String(error));
        };
        this._game = game;
        game.start();
        return true;
    }

    /** Stop the game and release everything (loop, listeners, scripts). */
    stop(): void {
        this._game?.destroy();
        this._game = null;
        this._hud?.destroy();
        this._hud = null;
    }
}

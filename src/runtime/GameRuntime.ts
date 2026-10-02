import { compileProject } from '../blocks/compile';
import type { KarenProject } from '../project/model';
import { ProjectGame } from './ProjectGame';

/**
 * Runs a project in the editor's preview canvas.
 * `start` always builds a brand-new engine from a snapshot of the project, so editing
 * while the game runs has no effect, and « Stop » then « Démarrer » restarts cleanly.
 */
export class GameRuntime {
    private _game: ProjectGame | null = null;

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
     * Returns false (and calls `onError`) when the project cannot be started.
     */
    start(canvas: HTMLCanvasElement, inputTarget: HTMLElement, project: KarenProject): boolean {
        this.stop();
        const snapshot = structuredClone(project);
        let code: string;
        try {
            code = compileProject(snapshot);
        } catch (e) {
            this.onError?.(`Les blocs n'ont pas pu être compilés : ${(e as Error).message}`);
            return false;
        }
        const game = new ProjectGame(snapshot, code);
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
    }
}

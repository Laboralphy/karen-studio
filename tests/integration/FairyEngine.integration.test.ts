import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FairyEngine } from '@fairy/FairyEngine';
import { FairyCamera } from '@fairy/FairyCamera';
import { FairyKeys } from '@fairy/FairyKeys';
import { FairyAnimation } from '@fairy/FairyAnimation';
import type { IFairyLayer } from '@fairy/IFairyLayer';
import type { Fairies } from '@fairy/Fairies';
import {
    installFakeCanvas,
    installFakeClock,
    key,
    type FakeClock,
    type FakeContext,
} from './fakes';

/** Layer recording what the engine asks of it. */
class SpyLayer implements IFairyLayer {
    constructor(
        private readonly _log: string[],
        private readonly _name: string
    ) {}
    proceed(): void {
        this._log.push(`${this._name}.proceed`);
    }
    render(): void {
        this._log.push(`${this._name}.render`);
    }
    setView(x: number, y: number): void {
        this._log.push(`${this._name}.view(${x},${y})`);
    }
}

/** Minimal game: counts ticks, exposes the input, can be told to crash. */
class TestGame extends FairyEngine {
    runningTicks = 0;
    initCount = 0;
    pressedAt: number[] = [];
    crashAt = -1;

    protected override stateGameInitializing(): void {
        this.initCount++;
    }

    protected override stateGameRunning(): null {
        this.runningTicks++;
        if (this._input.isKeyPressed(FairyKeys.SPACE)) {
            this.pressedAt.push(this.runningTicks);
        }
        if (this.runningTicks === this.crashAt) {
            throw new Error('boum');
        }
        return null;
    }

    isHeld(k: number): boolean {
        return this._input.getKeyState(k);
    }

    /** Expose the protected layer list for spy layers. */
    pushLayer(layer: IFairyLayer): void {
        (this as unknown as { _layers: IFairyLayer[] })._layers.push(layer);
    }
}

/** Ticks spent in the three set-up states before the first running tick. */
const SETUP_TICKS = 3;

describe('FairyEngine (intégration)', () => {
    let clock: FakeClock;
    let ctxOf: (c: HTMLCanvasElement) => FakeContext;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        ctxOf = installFakeCanvas();
        clock = installFakeClock();
        canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        document.body.appendChild(canvas);
    });

    afterEach(() => {
        canvas.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function startGame(game: TestGame = new TestGame()): TestGame {
        game.setCanvas(canvas);
        game.start();
        clock.frame(0); // starts the fixed-timestep clock
        return game;
    }

    it('enchaîne les états puis tourne à 30 ticks par seconde, quel que soit l’écran', () => {
        const game = startGame();
        for (let i = 1; i <= 60; i++) {
            clock.frame((i * 1000) / 60); // 1 s at 60 Hz
        }
        expect(game.initCount).toBe(1);
        expect(game.runningTicks).toBe(30 - SETUP_TICKS);
        game.destroy();
    });

    it('respecte une cadence de 20 ticks par seconde', () => {
        const game = new TestGame();
        game.setTickRate(20);
        startGame(game);
        for (let i = 1; i <= 144; i++) {
            clock.frame((i * 1000) / 144); // 1 s at 144 Hz
        }
        expect(game.runningTicks).toBe(20 - SETUP_TICKS);
        game.destroy();
    });

    it('fait avancer puis dessine les calques dans l’ordre, avec la caméra avant le rendu', () => {
        const game = startGame();
        const log: string[] = [];
        game.pushLayer(new SpyLayer(log, 'ciel'));
        game.pushLayer(new SpyLayer(log, 'sprites'));
        const cam = new FairyCamera(640, 480);
        cam.moveTo(100, 50);
        game.setCamera(cam);
        clock.ticks(SETUP_TICKS);
        log.length = 0;

        clock.ticks(1);
        expect(log).toEqual([
            'ciel.proceed',
            'sprites.proceed',
            'ciel.view(100,50)',
            'ciel.render',
            'sprites.view(100,50)',
            'sprites.render',
        ]);
        game.destroy();
    });

    it('rattrape plusieurs ticks dans une frame lente mais ne dessine qu’une fois', () => {
        const game = startGame();
        const log: string[] = [];
        game.pushLayer(new SpyLayer(log, 'l'));
        clock.ticks(SETUP_TICKS);
        log.length = 0;

        clock.frame(SETUP_TICKS * (1000 / 30) + 3 * (1000 / 30)); // 3 ticks late
        expect(log.filter((e) => e === 'l.proceed')).toHaveLength(3);
        expect(log.filter((e) => e === 'l.render')).toHaveLength(1);
        game.destroy();
    });

    it('efface l’écran avant chaque rendu', () => {
        const game = startGame();
        clock.ticks(SETUP_TICKS + 1);
        const clears = ctxOf(canvas).calls.filter((c) => c.name === 'clearRect');
        expect(clears.length).toBeGreaterThan(0);
        expect(clears[0].args).toEqual([0, 0, 640, 480]);
        game.destroy();
    });

    it('dessine les sprites décalés par la caméra', () => {
        const game = startGame();
        clock.ticks(SETUP_TICKS);
        const sheet = document.createElement('canvas');
        sheet.width = 64;
        sheet.height = 32;
        game.addImage('hero', sheet);
        const layer: Fairies = game.createFairyLayer();
        const hero = game.createFairy(layer, 'hero');
        hero.setSize(32, 32);
        hero.aAnimations.push(new FairyAnimation());
        hero.aAnimations[0].setFrameRange(1, 1);
        hero.aAnimations[0].setNoLoop();
        hero.playAnimation(0);
        hero.oFlight.vPosition.set(300, 200);
        const cam = new FairyCamera(640, 480);
        cam.moveTo(250.6, 100.2);
        game.setCamera(cam);

        const ctx = ctxOf(canvas);
        ctx.calls.length = 0;
        clock.ticks(1);
        const names = ctx.calls.map((c) => c.name);
        expect(names).toEqual(['clearRect', 'save', 'translate', 'drawImage', 'restore']);
        expect(ctx.calls[2].args).toEqual([-251, -101]);
        // Frame 1 of the sheet, drawn at the world position (the translate does the rest).
        expect(ctx.calls[3].args).toEqual([sheet, 32, 0, 32, 32, 300, 200, 32, 32]);
        game.destroy();
    });

    it('ne lit le clavier que sur la cible choisie et relâche tout à la perte du focus', () => {
        const game = new TestGame();
        game.setInputTarget(canvas);
        startGame(game);
        clock.ticks(SETUP_TICKS);

        key(window, 'keydown', FairyKeys.LEFT);
        expect(game.isHeld(FairyKeys.LEFT)).toBe(false);

        key(canvas, 'keydown', FairyKeys.RIGHT);
        expect(game.isHeld(FairyKeys.RIGHT)).toBe(true);

        canvas.dispatchEvent(new Event('blur'));
        expect(game.isHeld(FairyKeys.RIGHT)).toBe(false);
        game.destroy();
    });

    it('signale une touche « pressée » au tick suivant, une seule fois, même si l’appui est très bref', () => {
        const game = new TestGame();
        game.setInputTarget(canvas);
        startGame(game);
        clock.ticks(SETUP_TICKS + 2);

        key(canvas, 'keydown', FairyKeys.SPACE);
        key(canvas, 'keyup', FairyKeys.SPACE); // released before the next tick
        clock.ticks(3);
        expect(game.pressedAt).toEqual([3]);
        game.destroy();
    });

    it('empêche le défilement de la page par les flèches quand le jeu a le focus', () => {
        const game = new TestGame();
        game.setInputTarget(canvas);
        startGame(game);
        const e = new KeyboardEvent('keydown', {
            keyCode: FairyKeys.DOWN,
            cancelable: true,
        } as KeyboardEventInit);
        canvas.dispatchEvent(e);
        expect(e.defaultPrevented).toBe(true);
        game.destroy();
    });

    it('s’arrête et appelle onError quand le jeu plante', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const game = new TestGame();
        game.crashAt = 2;
        const onError = vi.fn();
        game.onError = onError;
        startGame(game);
        clock.ticks(SETUP_TICKS + 5);
        expect(onError).toHaveBeenCalledOnce();
        expect((onError.mock.calls[0][0] as Error).message).toBe('boum');
        expect(game.runningTicks).toBe(2);
        expect(clock.pending).toBe(false);
    });

    it('destroy arrête la boucle et détache le clavier', () => {
        const game = new TestGame();
        game.setInputTarget(canvas);
        startGame(game);
        clock.ticks(SETUP_TICKS + 2);
        game.destroy();
        expect(clock.pending).toBe(false);
        key(canvas, 'keydown', FairyKeys.RIGHT);
        expect(game.isHeld(FairyKeys.RIGHT)).toBe(false);
    });
});

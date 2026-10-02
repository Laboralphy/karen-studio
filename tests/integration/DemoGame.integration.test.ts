import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FairyKeys } from '@fairy/FairyKeys';
import type { Fairy } from '@fairy/Fairy';
import type { FairyCamera } from '@fairy/FairyCamera';
import type { TileContacts } from '@fairy/FairyTileCollision';
import { DemoGame } from '@runtime/demo/DemoGame';
import {
    installFakeCanvas,
    installFakeClock,
    key,
    type FakeClock,
    type FakeContext,
} from './fakes';

/** Private state of the demo, read by the test. */
interface DemoInternals {
    _player: Fairy;
    _slime: Fairy;
    _cam: FairyCamera;
    _playerContacts: TileContacts;
}

const SETUP_TICKS = 3;
/** Resting Y of a 32 px tall sprite on the ground (ground top = row 17 = 544 px). */
const GROUND_Y = 17 * 32 - 32;
const START_X = 64;

describe('Démo J1 (intégration, jouée tick par tick)', () => {
    let clock: FakeClock;
    let ctxOf: (c: HTMLCanvasElement) => FakeContext;
    let canvas: HTMLCanvasElement;
    let game: DemoGame;
    let demo: DemoInternals;

    beforeEach(() => {
        ctxOf = installFakeCanvas();
        clock = installFakeClock();
        canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        document.body.appendChild(canvas);
    });

    afterEach(() => {
        game?.destroy();
        canvas.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function startDemo(): void {
        game = new DemoGame();
        game.setCanvas(canvas);
        game.setInputTarget(canvas);
        game.start();
        clock.frame(0);
        clock.ticks(SETUP_TICKS);
        demo = game as unknown as DemoInternals;
    }

    const player = () => demo._player.oFlight.vPosition;
    const slime = () => demo._slime.oFlight.vPosition;
    const press = (k: number) => key(canvas, 'keydown', k);
    const release = (k: number) => key(canvas, 'keyup', k);

    it('la joueuse tombe et se pose sur le sol', () => {
        startDemo();
        clock.ticks(30);
        expect(player().y).toBe(GROUND_Y);
        expect(demo._playerContacts.bottom).toBe(true);
    });

    it('court à 5 px par tick et la caméra finit par la suivre', () => {
        startDemo();
        clock.ticks(30);
        press(FairyKeys.RIGHT);
        clock.ticks(20);
        expect(player().x).toBe(START_X + 100);
        expect(demo._cam.x).toBe(0); // still inside the dead zone
        clock.ticks(60);
        expect(player().x).toBe(START_X + 400);
        expect(demo._cam.x).toBeGreaterThan(0);
        release(FairyKeys.RIGHT);
        clock.ticks(5);
        expect(player().x).toBe(START_X + 400);
    });

    it('saute avec Espace puis retombe sur le sol', () => {
        startDemo();
        clock.ticks(30);
        press(FairyKeys.SPACE);
        clock.ticks(10);
        expect(player().y).toBeLessThan(GROUND_Y - 64);
        expect(demo._playerContacts.bottom).toBe(false);
        clock.ticks(40);
        expect(player().y).toBe(GROUND_Y);
        release(FairyKeys.SPACE);
    });

    it('un appui bref sur Espace donne un saut plus bas qu’un appui long', () => {
        const peak = (holdTicks: number): number => {
            startDemo();
            clock.ticks(30);
            press(FairyKeys.SPACE);
            let top = GROUND_Y;
            for (let i = 0; i < 40; i++) {
                if (i === holdTicks) {
                    release(FairyKeys.SPACE);
                }
                clock.ticks(1);
                top = Math.min(top, player().y);
            }
            game.destroy();
            return GROUND_Y - top;
        };
        const short = peak(1);
        const long = peak(40);
        expect(short).toBeGreaterThan(0);
        expect(long).toBeGreaterThan(short * 2);
    });

    it('est arrêtée par le mur de briques', () => {
        startDemo();
        clock.ticks(30);
        player().set(900, GROUND_Y);
        press(FairyKeys.RIGHT);
        clock.ticks(30);
        expect(player().x).toBe(31 * 32 - 24); // brick at column 31, box right edge = 24
    });

    it('tombe dans le trou et réapparaît au départ', () => {
        startDemo();
        clock.ticks(30);
        player().set(600, GROUND_Y);
        press(FairyKeys.RIGHT);
        clock.ticks(8); // reaches the pit
        release(FairyKeys.RIGHT);
        clock.ticks(40); // falls below the world
        expect(player().x).toBe(START_X);
        expect(player().y).toBeLessThanOrEqual(GROUND_Y);
    });

    it('le slime patrouille grâce à son script (coroutine)', () => {
        startDemo();
        const x0 = slime().x;
        clock.ticks(30);
        expect(slime().x).toBe(x0 + 60);
        expect(slime().y).toBe(GROUND_Y);
        clock.ticks(30 + 15); // end of the right walk, then the pause
        expect(slime().x).toBe(x0 + 120);
        clock.ticks(30);
        expect(slime().x).toBe(x0 + 60); // walking back
    });

    it('toucher le slime renvoie la joueuse au départ', () => {
        startDemo();
        clock.ticks(30);
        player().set(slime().x - 40, GROUND_Y);
        press(FairyKeys.RIGHT);
        clock.ticks(10);
        expect(player().x).toBeLessThan(200);
    });

    it('deux parties jouées avec les mêmes touches sont identiques', () => {
        const record = (): string => {
            startDemo();
            const ctx = ctxOf(canvas);
            ctx.calls.length = 0;
            press(FairyKeys.RIGHT);
            clock.ticks(40);
            press(FairyKeys.SPACE);
            clock.ticks(20);
            release(FairyKeys.SPACE);
            release(FairyKeys.RIGHT);
            clock.ticks(20);
            const draws = ctx.calls
                .filter((c) => c.name === 'drawImage' || c.name === 'translate')
                .map((c) => `${c.name}(${c.args.filter((a) => typeof a === 'number').join(',')})`);
            game.destroy();
            return draws.join(';');
        };
        const first = record();
        const second = record();
        expect(first.length).toBeGreaterThan(0);
        expect(second).toBe(first);
    });
});

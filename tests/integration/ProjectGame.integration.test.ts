import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FairyKeys } from '@fairy/FairyKeys';
import { newProject } from '@project/defaults';
import type { KarenProject } from '@project/model';
import { GameRuntime } from '@runtime/GameRuntime';
import type { ProjectGame } from '@runtime/ProjectGame';
import {
    installFakeCanvas,
    installFakeClock,
    key,
    type FakeClock,
    type FakeContext,
} from './fakes';

const SETUP_TICKS = 3;
/** Starter level: grass on row 12 → a 32 px sprite rests at y = 12 × 32 − 32. */
const GROUND_Y = 12 * 32 - 32;

describe('Projet de départ (intégration, joué tick par tick)', () => {
    let clock: FakeClock;
    let ctxOf: (c: HTMLCanvasElement) => FakeContext;
    let canvas: HTMLCanvasElement;
    let runtime: GameRuntime;

    beforeEach(() => {
        ctxOf = installFakeCanvas();
        clock = installFakeClock();
        canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        document.body.appendChild(canvas);
        runtime = new GameRuntime();
    });

    afterEach(() => {
        runtime.stop();
        canvas.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function play(project: KarenProject = newProject()): ProjectGame {
        expect(runtime.start(canvas, canvas, project)).toBe(true);
        clock.frame(0);
        clock.ticks(SETUP_TICKS);
        return runtime.game!;
    }

    const press = (k: number) => key(canvas, 'keydown', k);
    const release = (k: number) => key(canvas, 'keyup', k);

    it('crée l’héroïne au démarrage, qui tombe puis se pose sur l’herbe', () => {
        const game = play();
        clock.ticks(1);
        expect(game.sprites).toHaveLength(1);
        expect(game.sprites[0].name).toBe('Héroïne');
        clock.ticks(40);
        expect(game.sprites[0].fairy.oFlight.vPosition.y).toBe(GROUND_Y);
    });

    it('les flèches la font courir, la caméra la suit', () => {
        const game = play();
        clock.ticks(40);
        const pos = game.sprites[0].fairy.oFlight.vPosition;
        press(FairyKeys.RIGHT);
        clock.ticks(100); // 5 px per tick, past the camera dead zone (centre + 64 px)
        release(FairyKeys.RIGHT);
        clock.ticks(1);
        expect(pos.x).toBe(64 + 500);
        expect(game.camera.x).toBeGreaterThan(0);
        const x = pos.x;
        clock.ticks(5);
        expect(pos.x).toBe(x); // « sinon : vitesse x = 0 »
    });

    it('Espace la fait sauter seulement quand elle touche le sol', () => {
        const game = play();
        clock.ticks(40);
        const pos = game.sprites[0].fairy.oFlight.vPosition;
        press(FairyKeys.SPACE);
        release(FairyKeys.SPACE);
        clock.ticks(8);
        const inAir = pos.y;
        expect(inAir).toBeLessThan(GROUND_Y - 50);
        press(FairyKeys.SPACE); // second jump in the air: ignored
        release(FairyKeys.SPACE);
        clock.ticks(2);
        expect(pos.y).toBeGreaterThan(inAir - 30);
        clock.ticks(40);
        expect(pos.y).toBe(GROUND_Y);
    });

    it('dessine le fond, le niveau et le sprite', () => {
        play();
        const ctx = ctxOf(canvas);
        ctx.calls.length = 0;
        clock.ticks(1);
        expect(ctx.calls.filter((c) => c.name === 'drawImage').length).toBeGreaterThanOrEqual(3);
    });

    it('une erreur de script est signalée sans arrêter le jeu', () => {
        const project = newProject();
        // « mettre gravité de joueur » sans avoir créé le joueur : le script échoue.
        const code = project.code as { blocks: { blocks: { type: string; next?: unknown }[] } };
        const start = code.blocks.blocks[0];
        start.next = (start.next as { block: { next: unknown } }).block.next;
        const errors: string[] = [];
        runtime.onScriptError = (m) => errors.push(m);
        play(project);
        clock.ticks(5);
        expect(errors[0]).toMatch(/quand le niveau commence/);
        expect(errors[0]).toMatch(/a besoin d'un sprite/);
        expect(runtime.running).toBe(true);
    });

    it('refuse de démarrer un projet dont les blocs ne compilent pas', () => {
        const project = newProject();
        project.code = { blocks: { languageVersion: 0, blocks: [{ type: 'bloc_inconnu' }] } };
        const errors: string[] = [];
        runtime.onError = (m) => errors.push(m);
        expect(runtime.start(canvas, canvas, project)).toBe(false);
        expect(errors[0]).toMatch(/compilés/);
    });

    it('le jeu travaille sur une copie : modifier le projet pendant la partie n’a pas d’effet', () => {
        const project = newProject();
        play(project);
        project.sprites[0].name = 'Autre';
        clock.ticks(2);
        expect(runtime.game!.sprites[0].name).toBe('Héroïne');
    });

    it('dessine le ciel du niveau en premier, avec la parallaxe', () => {
        const project = newProject();
        project.levels[0].sky.parallax = 0.5;
        const game = play(project);
        clock.ticks(40);
        const ctx = ctxOf(canvas);
        const firstDraw = () => {
            ctx.calls.length = 0;
            clock.ticks(1);
            const draw = ctx.calls.find((c) => c.name === 'drawImage')!;
            return draw.args[1] as number;
        };
        expect(firstDraw()).toBe(0); // camera at the left edge
        key(canvas, 'keydown', FairyKeys.RIGHT);
        clock.ticks(100);
        const camX = game.camera.x;
        expect(camX).toBeGreaterThan(0);
        const x = firstDraw();
        // Repeated sky: offset = -camera × parallax, wrapped into [-640, 0].
        expect(x).toBe(-(Math.floor(game.camera.x * 0.5) % 640));
    });
});

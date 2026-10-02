import { FairyEngine } from '@fairy/FairyEngine';
import { FairyCamera } from '@fairy/FairyCamera';
import { FairyAnimation, LoopType } from '@fairy/FairyAnimation';
import { FairyKeys } from '@fairy/FairyKeys';
import type { Fairy } from '@fairy/Fairy';
import type { FairyMatrix } from '@fairy/FairyMatrix';
import {
    resolveTileCollision,
    TILE_AIR,
    TILE_SEMI_SOLID,
    TILE_SOLID,
    type TileBox,
    type TileContacts,
} from '@fairy/FairyTileCollision';
import { Observer } from '@fairy-core/Observer';
import type { FairyFlight } from '@fairy/FairyFlight';
import { Scheduler, type ScriptCoroutine } from '../Scheduler';
import {
    DemoTile,
    makePlayerSheet,
    makeSky,
    makeSlimeSheet,
    makeTileset,
    TILE,
} from './demoAssets';

const SCREEN_W = 640;
const SCREEN_H = 480;
const COLS = 60;
const ROWS = 20;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

/** Physics, in pixels per tick (30 ticks/s). */
const GRAVITY = 1.1;
const MAX_FALL = 16;
const RUN_SPEED = 5;
const JUMP_SPEED = -15;

const PLAYER_START = { x: 64, y: 480 };
const SLIME_START = { x: 25 * TILE, y: 16 * TILE };

/** Player's collision box: narrower than the 32×32 sprite. */
const PLAYER_BOX: TileBox = { left: 8, top: 2, right: 24, bottom: 32 };
const SLIME_BOX: TileBox = { left: 4, top: 14, right: 28, bottom: 32 };

/** Player animation indices in `aAnimations`. */
const ANIM_IDLE_RIGHT = 0;
const ANIM_WALK_RIGHT = 1;
const ANIM_IDLE_LEFT = 2;
const ANIM_WALK_LEFT = 3;

/** Tile and collision code for each level character. */
const LEVEL_CHARS: Record<string, [number, number]> = {
    '.': [DemoTile.Empty, TILE_AIR],
    G: [DemoTile.Grass, TILE_SOLID],
    D: [DemoTile.Dirt, TILE_SOLID],
    B: [DemoTile.Brick, TILE_SOLID],
    S: [DemoTile.Stone, TILE_SOLID],
    '=': [DemoTile.Platform, TILE_SEMI_SOLID],
};

/** Build the 60×20 demo level as rows of characters (see `LEVEL_CHARS`). */
export function buildDemoLevel(): string[] {
    const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
    const put = (ch: string, c0: number, c1: number, r0: number, r1 = r0): void => {
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                grid[r][c] = ch;
            }
        }
    };
    put('G', 0, COLS - 1, 17);
    put('D', 0, COLS - 1, 18, 19);
    put('.', 20, 22, 17, 19); // pit
    put('.', 41, 42, 17, 19); // pit
    put('=', 6, 9, 15);
    put('=', 11, 14, 13);
    put('=', 16, 19, 11);
    put('=', 24, 27, 14);
    put('B', 31, 32, 15, 16);
    put('S', 35, 38, 13);
    put('S', 48, 48, 16);
    put('S', 49, 49, 15, 16);
    put('S', 50, 50, 14, 16);
    put('S', 51, 53, 13, 16);
    put('=', 55, 58, 11);
    return grid.map((row) => row.join(''));
}

/**
 * J1 demo: a small platformer exercising the adapted engine — fixed timestep,
 * camera, parallax sky, tile collisions, key edges, and a slime driven by a
 * coroutine script (the model future Blockly code will follow).
 */
export class DemoGame extends FairyEngine {
    private readonly _scheduler = new Scheduler();
    private readonly _cam = new FairyCamera(SCREEN_W, SCREEN_H);
    private _matrix!: FairyMatrix;
    private _player!: Fairy;
    private _slime!: Fairy;
    private _playerContacts: TileContacts = {
        left: false,
        right: false,
        top: false,
        bottom: false,
    };
    private _facingLeft = false;

    protected override stateEngineInitializing(): void {
        this.setTickRate(30);
        this.addImage('tiles', makeTileset());
        this.addImage('sky', makeSky());
        this.addImage('player', makePlayerSheet());
        this.addImage('slime', makeSlimeSheet());
        this._scheduler.onError = (thread, error) =>
            console.warn(`Script « ${thread.name} » arrêté :`, error);
    }

    protected override stateGameInitializing(): void {
        const sky = this.createBackgroundLayer('sky', SCREEN_W, SCREEN_H);
        sky.setParallax(0.3, 0); // pas de parallaxe verticale : le ciel couvre tout l'écran
        sky.setRepeatX(true);

        this._matrix = this.createMatrixLayer('tiles', COLS, ROWS, TILE, TILE);
        buildDemoLevel().forEach((row, y) => {
            [...row].forEach((ch, x) => {
                const [gfx, code] = LEVEL_CHARS[ch];
                this._matrix.setTileGfx(x, y, gfx);
                this._matrix.setTileCode(x, y, code);
            });
        });

        const sprites = this.createFairyLayer();
        this._player = this._createPlayer(sprites);
        this._slime = this._createSlime(sprites);

        const hud = this.createCanvasLayer();
        const ctx = hud.canvas.getContext('2d')!;
        ctx.font = '14px monospace';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(8, 8, 392, 24);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('DÉMO  ← → courir   ↑ / Espace sauter', 16, 25);

        this._cam.setWorldSize(WORLD_W, WORLD_H);
        this._cam.setDeadZone(60, 40);
        this.setCamera(this._cam);
        this._cam.centerOn(PLAYER_START.x, PLAYER_START.y);

        this._scheduler.spawn('patrouille du slime', this._slimePatrol());
    }

    protected override stateGameRunning(): string | null {
        this._scheduler.tick();
        this._controlPlayer();
        this._checkHazards();
        this._cam.follow({
            x: this._player.oFlight.vPosition.x + TILE / 2,
            y: this._player.oFlight.vPosition.y + TILE / 2,
        });
        return null;
    }

    override destroy(): void {
        this._scheduler.stopAll();
        super.destroy();
    }

    // ── Player ───────────────────────────────────────────────────────────────

    private _createPlayer(layer: ReturnType<FairyEngine['createFairyLayer']>): Fairy {
        const p = this.createFairy(layer, 'player');
        p.setSize(TILE, TILE);
        p.aAnimations.push(
            DemoGame._anim(0, 1, 0),
            DemoGame._anim(1, 2, 4),
            DemoGame._anim(3, 1, 0),
            DemoGame._anim(4, 2, 4)
        );
        p.playAnimation(ANIM_IDLE_RIGHT);
        p.oFlight.vPosition.set(PLAYER_START.x, PLAYER_START.y);
        p.oFlight.vAccel.set(0, GRAVITY);
        p.oObservatory.attach(
            'move',
            new Observer<Fairy, FairyFlight>(this, (_sender, flight) => {
                this._playerContacts = resolveTileCollision(flight, PLAYER_BOX, this._matrix);
            })
        );
        return p;
    }

    private _controlPlayer(): void {
        const input = this._input;
        const flight = this._player.oFlight;
        const left = input.getKeyState(FairyKeys.LEFT);
        const right = input.getKeyState(FairyKeys.RIGHT);
        flight.vSpeed.x = left === right ? 0 : left ? -RUN_SPEED : RUN_SPEED;

        const jump = input.isKeyPressed(FairyKeys.UP) || input.isKeyPressed(FairyKeys.SPACE);
        if (jump && this._playerContacts.bottom) {
            flight.vSpeed.y = JUMP_SPEED;
        }
        // Releasing the jump key early cuts the jump: short tap = small hop.
        const jumpHeld = input.getKeyState(FairyKeys.UP) || input.getKeyState(FairyKeys.SPACE);
        if (!jumpHeld && flight.vSpeed.y < JUMP_SPEED / 3) {
            flight.vSpeed.y = JUMP_SPEED / 3;
        }
        flight.vSpeed.y = Math.min(flight.vSpeed.y, MAX_FALL);

        if (left !== right) {
            this._facingLeft = left;
        }
        const moving = flight.vSpeed.x !== 0;
        const anim = this._facingLeft
            ? moving
                ? ANIM_WALK_LEFT
                : ANIM_IDLE_LEFT
            : moving
              ? ANIM_WALK_RIGHT
              : ANIM_IDLE_RIGHT;
        if (this._player.oAnimation !== this._player.aAnimations[anim]) {
            this._player.playAnimation(anim);
        }
    }

    /** Respawn the player after a fall or when touching the slime. */
    private _checkHazards(): void {
        const p = this._player.oFlight.vPosition;
        const s = this._slime.oFlight.vPosition;
        const fell = p.y > WORLD_H + TILE;
        const touched =
            p.x + PLAYER_BOX.left < s.x + SLIME_BOX.right &&
            s.x + SLIME_BOX.left < p.x + PLAYER_BOX.right &&
            p.y + PLAYER_BOX.top < s.y + SLIME_BOX.bottom &&
            s.y + SLIME_BOX.top < p.y + PLAYER_BOX.bottom;
        if (fell || touched) {
            this._player.oFlight.vPosition.set(PLAYER_START.x, PLAYER_START.y);
            this._player.oFlight.vSpeed.set(0, 0);
            this._cam.centerOn(PLAYER_START.x, PLAYER_START.y);
        }
    }

    // ── Slime (driven by a coroutine, like future block scripts) ─────────────

    private _createSlime(layer: ReturnType<FairyEngine['createFairyLayer']>): Fairy {
        const s = this.createFairy(layer, 'slime');
        s.setSize(TILE, TILE);
        s.aAnimations.push(DemoGame._anim(0, 2, 8));
        s.playAnimation(0);
        s.oFlight.vPosition.set(SLIME_START.x, SLIME_START.y);
        s.oFlight.vAccel.set(0, GRAVITY);
        s.oObservatory.attach(
            'move',
            new Observer<Fairy, FairyFlight>(this, (_sender, flight) => {
                resolveTileCollision(flight, SLIME_BOX, this._matrix);
            })
        );
        return s;
    }

    /** « Répéter indéfiniment : aller à droite 2 s, attendre, aller à gauche 2 s, attendre ». */
    private *_slimePatrol(): ScriptCoroutine {
        const flight = this._slime.oFlight;
        for (;;) {
            for (const dir of [1, -1]) {
                flight.vSpeed.x = 2 * dir;
                yield 60;
                flight.vSpeed.x = 0;
                yield 15;
            }
        }
    }

    /** Looping animation of `count` frames from `start`, `dur` ticks per frame (0 = still). */
    private static _anim(start: number, count: number, dur: number): FairyAnimation {
        const a = new FairyAnimation();
        a.setFrameRange(start, count);
        if (dur > 0) {
            a.setLoop(LoopType.Forward, 1, dur, 0);
        } else {
            a.setNoLoop();
        }
        return a;
    }
}

import { FairyEngine } from '@fairy/FairyEngine';
import { FairyCamera } from '@fairy/FairyCamera';
import { FairyAnimation, LoopType } from '@fairy/FairyAnimation';
import type { Fairy } from '@fairy/Fairy';
import type { Fairies } from '@fairy/Fairies';
import type { FairyFlight } from '@fairy/FairyFlight';
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
import {
    ASSET_SIZE,
    EMPTY_TILE,
    type BobCollision,
    type KarenProject,
    type Marker,
    type SpriteAsset,
} from '../project/model';
import { buildSpriteSheet, buildTileset, type SheetRange } from '../project/render';
import { renderSky, SKY_HEIGHT, SKY_WIDTH } from '../project/sky';
import type { FairyLayer } from '@fairy/FairyLayer';
import { Scheduler, type ScriptCoroutine, type ScriptThread } from './Scheduler';
import { SoundPlayer, type SoundHandle } from './SoundPlayer';
import { NO_HUD, type HudOutput } from './HudLayer';
import { displayValue } from '../project/hud';

const SCREEN_W = 640;
const SCREEN_H = 480;
/** Speed limit (pixels per tick) on each axis, so a runaway value cannot explode the game. */
const MAX_SPEED = 32;
/** Collision box of every sprite (J2: the full 32×32 square). */
const SPRITE_BOX: TileBox = { left: 0, top: 0, right: ASSET_SIZE, bottom: ASSET_SIZE };

const COLLISION_CODES: Record<BobCollision, number> = {
    air: TILE_AIR,
    solid: TILE_SOLID,
    platform: TILE_SEMI_SOLID,
};

/** Error raised by a block, with a message for the young programmer. */
export class ScriptError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ScriptError';
    }
}

/** A sprite created by a script. Blocks hold it in variables. */
export class SpriteInstance {
    private static _nextId = 1;
    /** Unique number of this instance (used to track per-sprite event scripts). */
    readonly id = SpriteInstance._nextId++;
    contacts: TileContacts = { left: false, right: false, top: false, bottom: false };
    alive = true;
    /** Index in `fairy.aAnimations` of the animation playing (0 = still first image). */
    animation = 0;
    /** True once « animation terminée » was fired for the current animation. */
    animationEndFired = false;
    facingLeft = false;

    constructor(
        readonly asset: SpriteAsset,
        readonly fairy: Fairy
    ) {}

    get name(): string {
        return this.asset.name;
    }

    /** The sprite's tag, without surrounding spaces. */
    get tag(): string {
        return this.asset.tag.trim();
    }

    /** True if the sprite was stopped by a tile on any side during the last tick. */
    get touchesTile(): boolean {
        const c = this.contacts;
        return c.left || c.right || c.top || c.bottom;
    }

    /** True if the sprite's 32×32 square overlaps the cell `(col, row)`. */
    overlapsCell(col: number, row: number): boolean {
        const a = this.fairy.oFlight.vPosition;
        const x = col * ASSET_SIZE;
        const y = row * ASSET_SIZE;
        return (
            a.x < x + ASSET_SIZE &&
            x < a.x + ASSET_SIZE &&
            a.y < y + ASSET_SIZE &&
            y < a.y + ASSET_SIZE
        );
    }

    /** True if the 32×32 squares of both sprites overlap. */
    overlaps(other: SpriteInstance): boolean {
        const a = this.fairy.oFlight.vPosition;
        const b = other.fairy.oFlight.vPosition;
        return (
            a.x < b.x + ASSET_SIZE &&
            b.x < a.x + ASSET_SIZE &&
            a.y < b.y + ASSET_SIZE &&
            b.y < a.y + ASSET_SIZE
        );
    }
}

/** A « registre »: numbers stored under names. */
export class Register {
    readonly values = new Map<string, number>();
}

type SpriteProp = 'x' | 'y' | 'vx' | 'vy' | 'gravity';
type TouchSide = 'left' | 'right' | 'top' | 'bottom' | 'any';

/** A script body compiled from a hat block; sprite events receive the sprites concerned. */
type ScriptBody = (...sprites: SpriteInstance[]) => ScriptCoroutine;

/** An event handler compiled from a hat block. */
interface Handler {
    label: string;
    run: ScriptBody;
}

/**
 * The API seen by compiled block code (as `__k`). Every block calls one of these.
 * Operations on a destroyed sprite are silently ignored.
 */
export interface ScriptApi {
    onStart(label: string, run: ScriptBody): void;
    onLevelStart(label: string, run: ScriptBody): void;
    onTick(label: string, run: ScriptBody): void;
    onKey(key: number, state: 'down' | 'up', label: string, run: ScriptBody): void;
    onSpriteTile(tag: string, label: string, run: ScriptBody): void;
    onSpriteSprite(tag: string, other: string, label: string, run: ScriptBody): void;
    onSoundEnd(soundId: number, label: string, run: ScriptBody): void;
    onAnimationEnd(tag: string, label: string, run: ScriptBody): void;
    onSpriteMarker(tag: string, markerTag: string, label: string, run: ScriptBody): void;
    /** « ce sprite » used outside a sprite event: always throws. */
    noEventSprite(block: string): never;
    keyDown(key: number): boolean;
    createSprite(assetId: number, x: unknown, y: unknown): SpriteInstance;
    setProp(sprite: unknown, prop: SpriteProp, value: unknown): void;
    changeProp(sprite: unknown, prop: SpriteProp, delta: unknown): void;
    getProp(sprite: unknown, prop: SpriteProp): number;
    moveSprite(sprite: unknown, dx: unknown, dy: unknown): void;
    touching(sprite: unknown, side: TouchSide): boolean;
    destroySprite(sprite: unknown): void;
    cameraFollow(sprite: unknown): void;
    cameraMoveTo(x: unknown, y: unknown): void;
    /** Convert seconds into a number of ticks to wait (at least 1). */
    ticks(seconds: unknown): number;
    guard(): void;
    dictCreate(): Register;
    dictSet(dict: unknown, key: unknown, value: unknown): void;
    dictChange(dict: unknown, key: unknown, delta: unknown): void;
    dictGet(dict: unknown, key: unknown): number;
    dictHas(dict: unknown, key: unknown): boolean;
    dictRemove(dict: unknown, key: unknown): void;
    /** Replace a tile (BOB id, 0 = empty). Cells outside the level are ignored. */
    setTile(col: unknown, row: unknown, bobId: number): void;
    tileIs(col: unknown, row: unknown, bobId: number): boolean;
    cellOf(sprite: unknown, axis: 'col' | 'row'): number;
    /** Switch level at the end of the tick. */
    goToLevel(levelId: number): void;
    /** Play a sound; returns its length in ticks (for « jouer le son jusqu'au bout »). */
    playSound(soundId: number): number;
    stopSound(soundId: number): void;
    stopAllSounds(): void;
    /** Play one of the sprite's animations (by name); no restart if it is already playing. */
    setAnimation(sprite: unknown, name: string): void;
    face(sprite: unknown, side: 'left' | 'right'): void;
    /** Pixel position (top-left) of the n-th (1-based) marker with this tag. */
    markerPos(tag: string, axis: 'x' | 'y', n: unknown): number;
    markerCount(tag: string): number;
    /** Called once by compiled code: gives the block variables by name (for the interface). */
    vars(getter: () => Record<string, unknown>): void;
    hudShow(textId: number, visible: boolean): void;
    hudSet(textId: number, template: unknown): void;
}

/** Labels of the sprite properties, for error messages. */
const PROP_LABELS: Record<SpriteProp, string> = {
    x: 'position x',
    y: 'position y',
    vx: 'vitesse x',
    vy: 'vitesse y',
    gravity: 'gravité',
};

/**
 * A game built from a Karen Studio project: its levels (starting with the first one),
 * BOB, sprites, and the compiled block scripts run as coroutines by a `Scheduler`.
 */
export class ProjectGame extends FairyEngine {
    private readonly _scheduler = new Scheduler();
    private readonly _cam = new FairyCamera(SCREEN_W, SCREEN_H);
    private _matrix!: FairyMatrix;
    /** Sky behind the level, scrolled with parallax. */
    private _sky!: FairyLayer;
    private _spriteLayer!: Fairies;
    private _sprites: SpriteInstance[] = [];
    private _follow: SpriteInstance | null = null;
    /** BOB by id. */
    private _bobs = new Map<number, KarenProject['bobs'][number]>();
    /** Tile index of each BOB id in the generated tileset. */
    private _tileOf = new Map<number, number>();
    /** Collision code of each BOB id. */
    private _collisionOf = new Map<number, number>();
    /** Index (in the project) of the level being played. */
    private _levelIndex = 0;
    /** Tiles of the level being played (modified by « mettre la case »). */
    private _tiles: number[] = [];
    /** Level requested by « aller au niveau », applied at the end of the tick. */
    private _pendingLevel: number | null = null;
    private readonly _startHandlers: Handler[] = [];
    private readonly _levelStartHandlers: Handler[] = [];
    private readonly _tickHandlers: Handler[] = [];
    private readonly _keyHandlers: { key: number; state: 'down' | 'up'; handler: Handler }[] = [];
    private readonly _tileHandlers: { tag: string; handler: Handler }[] = [];
    private readonly _pairHandlers: { tag: string; other: string; handler: Handler }[] = [];
    private readonly _soundEndHandlers: { soundId: number; handler: Handler }[] = [];
    private readonly _animationEndHandlers: { tag: string; handler: Handler }[] = [];
    private readonly _markerHandlers: { tag: string; marker: string; handler: Handler }[] = [];
    /** Sprite sheet layout: for each sprite id, the cells of each animation. */
    private readonly _sheets = new Map<number, SheetRange[]>();
    /** Sounds being played, with the tick at which they end. */
    private _playing: { soundId: number; endTick: number; handle: SoundHandle | null }[] = [];
    /** Number of running ticks so far. */
    private _tick = 0;
    /** Block variables by name (set by the compiled code). */
    private _vars: () => Record<string, unknown> = () => ({});
    /**
     * Last thread started by each handler (per sprite or sprite pair for sprite events),
     * to avoid piling up unfinished runs.
     */
    private readonly _threads = new Map<Handler, Map<string, ScriptThread>>();

    /** Called when a script stops because of an error; the game keeps running. */
    onScriptError: ((message: string) => void) | null = null;

    /**
     * @param project - The project to play (not modified; pass a copy if it may change).
     * @param code    - The project's compiled block code (see `compileProject`).
     */
    constructor(
        private readonly _project: KarenProject,
        private readonly _code: string,
        private readonly _audio: SoundPlayer = new SoundPlayer(null),
        private readonly _hud: HudOutput = NO_HUD
    ) {
        super();
        this._scheduler.onError = (thread, error) => {
            const message =
                error instanceof RangeError
                    ? 'trop d’appels de fonction imbriqués (une fonction qui s’appelle sans fin ?)'
                    : error instanceof Error
                      ? error.message
                      : String(error);
            this.onScriptError?.(`Script « ${thread.name} » arrêté : ${message}`);
        };
    }

    /** Sprites currently alive, in creation order. */
    get sprites(): readonly SpriteInstance[] {
        return this._sprites;
    }

    /** The game camera. */
    get camera(): FairyCamera {
        return this._cam;
    }

    /** The level being played. */
    get level(): KarenProject['levels'][number] {
        return this._project.levels[this._levelIndex];
    }

    protected override stateEngineInitializing(): void {
        const p = this._project;
        this.setTickRate(p.settings.tickRate);
        const tileset = buildTileset(p.bobs, p.palette);
        this.addImage('tiles', tileset.image);
        this._tileOf = tileset.tileOf;
        for (const sprite of p.sprites) {
            const sheet = buildSpriteSheet(sprite, p.palette);
            this.addImage(`sprite:${sprite.id}`, sheet.image);
            this.addImage(
                `sprite:${sprite.id}:left`,
                buildSpriteSheet(sprite, p.palette, true).image
            );
            this._sheets.set(sprite.id, sheet.ranges);
        }
        for (const level of p.levels) {
            this.addImage(`sky:${level.id}`, renderSky(level.sky));
        }
        this._audio.prepare(p.sounds);
    }

    protected override stateGameInitializing(): void {
        const p = this._project;
        const first = p.levels[0];

        this._sky = this.createBackgroundLayer(`sky:${first.id}`, SKY_WIDTH, SKY_HEIGHT);
        this._sky.setRepeatX(true);

        this._collisionOf = new Map(p.bobs.map((b) => [b.id, COLLISION_CODES[b.collision]]));
        this._bobs = new Map(p.bobs.map((b) => [b.id, b]));
        this._matrix = this.createMatrixLayer(
            'tiles',
            first.cols,
            first.rows,
            ASSET_SIZE,
            ASSET_SIZE
        );
        this._spriteLayer = this.createFairyLayer();
        this._cam.setDeadZone(64, 48);
        this.setCamera(this._cam);

        // Run the compiled program: it registers the event handlers.
        new Function('__k', this._code)(this._api());
        for (const handler of this._startHandlers) {
            this._start(handler);
        }
        this._loadLevel(0);
    }

    /**
     * Show level `index` from its original tiles, then start the « quand le niveau
     * commence » scripts. Existing sprites are destroyed.
     */
    private _loadLevel(index: number): void {
        for (const s of this._sprites) {
            s.alive = false;
            s.fairy.bDead = true;
        }
        this._sprites = [];
        this._follow = null;

        this._levelIndex = index;
        const level = this._project.levels[index];
        this._tiles = [...level.tiles];
        this._matrix.setSize(level.cols, level.rows, ASSET_SIZE, ASSET_SIZE);
        for (let y = 0; y < level.rows; y++) {
            for (let x = 0; x < level.cols; x++) {
                const bobId = this._tiles[y * level.cols + x];
                if (bobId !== EMPTY_TILE) {
                    this._placeBob(x, y, bobId);
                }
            }
        }
        this._sky.setImage(this._images.get(`sky:${level.id}`)!);
        this._sky.setParallax(level.sky.parallax, 0);
        this._cam.setWorldSize(level.cols * ASSET_SIZE, level.rows * ASSET_SIZE);
        this._cam.moveTo(0, level.rows * ASSET_SIZE);
        for (const handler of this._levelStartHandlers) {
            this._start(handler);
        }
    }

    protected override stateGameRunning(): null {
        this._tick++;
        this._dispatchSoundEnds();
        for (const { key, state, handler } of this._keyHandlers) {
            const fired =
                state === 'down' ? this._input.isKeyPressed(key) : this._input.isKeyReleased(key);
            if (fired) {
                this._start(handler);
            }
        }
        for (const handler of this._tickHandlers) {
            this._start(handler);
        }
        // Sprite events use the contacts and positions of the last physics step.
        for (const { tag, handler } of this._tileHandlers) {
            for (const s of this._sprites) {
                if (s.alive && s.tag === tag && s.touchesTile) {
                    this._start(handler, [s]);
                }
            }
        }
        for (const { tag, other, handler } of this._pairHandlers) {
            for (const a of this._sprites) {
                if (!a.alive || a.tag !== tag) continue;
                for (const b of this._sprites) {
                    if (b !== a && b.alive && b.tag === other && a.overlaps(b)) {
                        this._start(handler, [a, b]);
                    }
                }
            }
        }
        for (const { tag, marker, handler } of this._markerHandlers) {
            for (const m of this.level.markers) {
                if (m.tag.trim() !== marker) continue;
                for (const s of this._sprites) {
                    if (s.alive && s.tag === tag && s.overlapsCell(m.col, m.row)) {
                        this._start(handler, [s], `m${m.id}`);
                    }
                }
            }
        }
        for (const s of this._sprites) {
            if (s.alive && !s.animationEndFired && s.fairy.oAnimation?.bOver) {
                s.animationEndFired = true;
                for (const { tag, handler } of this._animationEndHandlers) {
                    if (s.tag === tag) this._start(handler, [s]);
                }
            }
        }

        this._scheduler.tick();
        this._sprites = this._sprites.filter((s) => s.alive);

        if (this._pendingLevel !== null) {
            const index = this._pendingLevel;
            this._pendingLevel = null;
            this._loadLevel(index);
        }
        if (this._follow) {
            const pos = this._follow.fairy.oFlight.vPosition;
            this._cam.follow({ x: pos.x + ASSET_SIZE / 2, y: pos.y + ASSET_SIZE / 2 });
        }
        this._hud.update(this.hudContext());
        return null;
    }

    /**
     * Values available to interface templates: `niveau` (level name), `temps` (whole
     * seconds since the start), then every block variable (they win over these two).
     */
    hudContext(): Record<string, unknown> {
        const context: Record<string, unknown> = {
            niveau: this.level.name,
            temps: Math.floor(this._tick / this.getTickRate()),
        };
        let vars: Record<string, unknown> = {};
        try {
            vars = this._vars();
        } catch (e) {
            // Never stop the game because of the interface: report once, then show no values.
            this._vars = () => ({});
            this.onScriptError?.(`Interface : variables illisibles (${(e as Error).message}).`);
        }
        for (const [name, value] of Object.entries(vars)) {
            context[name] =
                value instanceof Register
                    ? Object.fromEntries([...value.values].map(([k, v]) => [k, displayValue(v)]))
                    : value instanceof SpriteInstance
                      ? value.name
                      : (displayValue(value) ?? '');
        }
        return context;
    }

    override destroy(): void {
        this._scheduler.stopAll();
        this._stopSounds(() => true);
        super.destroy();
    }

    /** Put a BOB in a cell (graphics, collision, animation). */
    private _placeBob(x: number, y: number, bobId: number): void {
        const bob = this._bobs.get(bobId);
        const tile = this._tileOf.get(bobId) ?? 0;
        this._matrix.setTile(x, y, tile, this._collisionOf.get(bobId) ?? TILE_AIR);
        if (bob && bob.frames.length > 1) {
            this._matrix.setTileAnimation(x, y, tile, bob.frames.length, bob.frameDuration);
        }
    }

    /** Start « quand le son … est terminé » for every sound that ended. */
    private _dispatchSoundEnds(): void {
        const ended = this._playing.filter((p) => p.endTick <= this._tick);
        if (ended.length === 0) return;
        this._playing = this._playing.filter((p) => p.endTick > this._tick);
        for (const { soundId } of ended) {
            for (const h of this._soundEndHandlers) {
                if (h.soundId === soundId) {
                    this._start(h.handler);
                }
            }
        }
    }

    /** Stop (without « terminé » event) the sounds matching `which`. */
    private _stopSounds(which: (soundId: number) => boolean): void {
        for (const p of this._playing) {
            if (which(p.soundId)) {
                p.handle?.stop();
            }
        }
        this._playing = this._playing.filter((p) => !which(p.soundId));
    }

    /**
     * Start a handler, unless its previous run (for the same sprites, for sprite events)
     * is still going.
     */
    private _start(handler: Handler, sprites: SpriteInstance[] = [], extraKey = ''): void {
        let runs = this._threads.get(handler);
        if (!runs) {
            runs = new Map();
            this._threads.set(handler, runs);
        }
        const key = sprites.map((s) => s.id).join(':') + extraKey;
        const previous = runs.get(key);
        if (previous && !previous.done) {
            return;
        }
        runs.set(key, this._scheduler.spawn(handler.label, handler.run(...sprites)));
    }

    /** Check that an interface text exists. */
    private _hudText(id: number): number {
        if (!this._project.hud.some((t) => t.id === id)) {
            throw new ScriptError("Choisis un texte de l'onglet Interface dans la liste.");
        }
        return id;
    }

    /** The n-th (1-based) marker with this tag in the current level. */
    private _marker(tag: string, n: unknown): Marker {
        const index = num(n, 'marqueur');
        const markers = this.level.markers.filter((m) => m.tag.trim() === tag);
        const marker = markers[index - 1];
        if (!marker) {
            throw new ScriptError(
                markers.length === 0
                    ? `Le niveau « ${this.level.name} » n'a pas de marqueur « ${tag} ».`
                    : `Le niveau « ${this.level.name} » n'a que ${markers.length} marqueur(s) « ${tag} » (demandé : n° ${index}).`
            );
        }
        return marker;
    }

    /** Check that `(col, row)` are whole numbers inside the current level. */
    private _cell(col: unknown, row: unknown, block: string): [number, number] | null {
        const x = num(col, block);
        const y = num(row, block);
        const level = this.level;
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            throw new ScriptError(`« ${block} » : la colonne et la ligne doivent être entières.`);
        }
        return x >= 0 && y >= 0 && x < level.cols && y < level.rows ? [x, y] : null;
    }

    private _createSprite(assetId: number, x: number, y: number): SpriteInstance {
        const asset = this._project.sprites.find((s) => s.id === assetId);
        if (!asset) {
            throw new ScriptError('« créer le sprite » : choisis un sprite dans la liste.');
        }
        const fairy = this.createFairy(this._spriteLayer, `sprite:${asset.id}`);
        fairy.setSize(ASSET_SIZE, ASSET_SIZE);
        // Animation 0: the first image, still. Then one per sprite animation.
        const still = new FairyAnimation();
        still.setFrameRange(0, 1);
        still.setNoLoop();
        fairy.aAnimations.push(still);
        const ranges = this._sheets.get(asset.id) ?? [];
        asset.animations.forEach((a, i) => {
            const anim = new FairyAnimation();
            anim.setFrameRange(ranges[i].start, ranges[i].count);
            anim.setLoop(LoopType.Forward, 1, a.frameDuration, a.loop ? 0 : 1);
            fairy.aAnimations.push(anim);
        });
        fairy.oFlight.vPosition.set(x, y);

        const instance = new SpriteInstance(asset, fairy);
        instance.animation = asset.animations.length > 0 ? 1 : 0;
        fairy.playAnimation(instance.animation);
        fairy.oObservatory.attach(
            'move',
            new Observer<Fairy, FairyFlight>(this, (_sender, flight) => {
                const speed = flight.vNewSpeed;
                speed.x = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, speed.x));
                speed.y = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, speed.y));
                flight.vNewPosition.set(flight.vPosition).add(speed);
                instance.contacts = resolveTileCollision(flight, SPRITE_BOX, this._matrix);
            })
        );
        this._sprites.push(instance);
        return instance;
    }

    /** Build the object exposed to compiled code as `__k`. */
    private _api(): ScriptApi {
        const register = (list: Handler[]) => (label: string, run: ScriptBody) => {
            list.push({ label, run });
        };
        return {
            onStart: register(this._startHandlers),
            onLevelStart: register(this._levelStartHandlers),
            onTick: register(this._tickHandlers),
            onKey: (key, state, label, run) => {
                this._keyHandlers.push({ key, state, handler: { label, run } });
            },
            onSpriteTile: (tag, label, run) => {
                this._tileHandlers.push({ tag: tag.trim(), handler: { label, run } });
            },
            onSpriteSprite: (tag, other, label, run) => {
                this._pairHandlers.push({
                    tag: tag.trim(),
                    other: other.trim(),
                    handler: { label, run },
                });
            },
            onSoundEnd: (soundId, label, run) => {
                this._soundEndHandlers.push({ soundId, handler: { label, run } });
            },
            onAnimationEnd: (tag, label, run) => {
                this._animationEndHandlers.push({ tag: tag.trim(), handler: { label, run } });
            },
            onSpriteMarker: (tag, marker, label, run) => {
                this._markerHandlers.push({
                    tag: tag.trim(),
                    marker: marker.trim(),
                    handler: { label, run },
                });
            },
            noEventSprite: (block) => {
                throw new ScriptError(
                    `« ${block} » ne marche que sous un événement « quand un sprite … touche … ». ` +
                        'Dans une fonction, passe le sprite en paramètre.'
                );
            },
            keyDown: (key) => this._input.getKeyState(key),
            createSprite: (assetId, x, y) =>
                this._createSprite(assetId, num(x, 'créer le sprite'), num(y, 'créer le sprite')),
            setProp: (sprite, prop, value) => {
                const s = asSprite(sprite, `mettre ${PROP_LABELS[prop]}`);
                if (s.alive) {
                    writeProp(s.fairy.oFlight, prop, num(value, `mettre ${PROP_LABELS[prop]}`));
                }
            },
            changeProp: (sprite, prop, delta) => {
                const s = asSprite(sprite, `ajouter à ${PROP_LABELS[prop]}`);
                if (s.alive) {
                    const flight = s.fairy.oFlight;
                    writeProp(
                        flight,
                        prop,
                        readProp(flight, prop) + num(delta, `ajouter à ${PROP_LABELS[prop]}`)
                    );
                }
            },
            getProp: (sprite, prop) =>
                readProp(asSprite(sprite, PROP_LABELS[prop]).fairy.oFlight, prop),
            moveSprite: (sprite, dx, dy) => {
                const s = asSprite(sprite, 'déplacer');
                if (s.alive) {
                    s.fairy.oFlight.vPosition.x += num(dx, 'déplacer');
                    s.fairy.oFlight.vPosition.y += num(dy, 'déplacer');
                }
            },
            touching: (sprite, side) => {
                const s = asSprite(sprite, 'touche');
                if (!s.alive) {
                    return false;
                }
                const c = s.contacts;
                return side === 'any' ? c.left || c.right || c.top || c.bottom : c[side];
            },
            destroySprite: (sprite) => {
                const s = asSprite(sprite, 'détruire');
                s.alive = false;
                s.fairy.bDead = true;
                if (this._follow === s) {
                    this._follow = null;
                }
            },
            cameraFollow: (sprite) => {
                const s = asSprite(sprite, 'la caméra suit');
                this._follow = s.alive ? s : null;
            },
            cameraMoveTo: (x, y) => {
                this._follow = null;
                this._cam.moveTo(num(x, 'placer la caméra'), num(y, 'placer la caméra'));
            },
            ticks: (seconds) =>
                Math.max(1, Math.round(num(seconds, 'attendre') * this.getTickRate())),
            guard: () => this._scheduler.guard(),

            dictCreate: () => new Register(),
            dictSet: (dict, key, value) => {
                asRegister(dict, 'mettre l’élément').values.set(
                    String(key),
                    num(value, 'mettre l’élément')
                );
            },
            dictChange: (dict, key, delta) => {
                const values = asRegister(dict, 'ajouter à l’élément').values;
                const k = String(key);
                values.set(k, (values.get(k) ?? 0) + num(delta, 'ajouter à l’élément'));
            },
            dictGet: (dict, key) =>
                asRegister(dict, 'élément du registre').values.get(String(key)) ?? 0,
            dictHas: (dict, key) =>
                asRegister(dict, 'le registre contient').values.has(String(key)),
            dictRemove: (dict, key) => {
                asRegister(dict, 'retirer l’élément').values.delete(String(key));
            },

            setTile: (col, row, bobId) => {
                const cell = this._cell(col, row, 'mettre la case');
                if (!cell) return;
                if (bobId !== EMPTY_TILE && !this._tileOf.has(bobId)) {
                    throw new ScriptError('« mettre la case » : choisis un BOB dans la liste.');
                }
                const [x, y] = cell;
                this._tiles[y * this.level.cols + x] = bobId;
                this._placeBob(x, y, bobId);
            },
            tileIs: (col, row, bobId) => {
                const cell = this._cell(col, row, 'la case est');
                return cell !== null && this._tiles[cell[1] * this.level.cols + cell[0]] === bobId;
            },
            cellOf: (sprite, axis) => {
                const pos = asSprite(sprite, 'case sous').fairy.oFlight.vPosition;
                return Math.floor(((axis === 'col' ? pos.x : pos.y) + ASSET_SIZE / 2) / ASSET_SIZE);
            },
            goToLevel: (levelId) => {
                const index = this._project.levels.findIndex((l) => l.id === levelId);
                if (index < 0) {
                    throw new ScriptError('« aller au niveau » : choisis un niveau dans la liste.');
                }
                this._pendingLevel = index;
            },

            playSound: (soundId) => {
                if (!this._audio.has(soundId)) {
                    throw new ScriptError('« jouer le son » : choisis un son dans la liste.');
                }
                const ticks = Math.max(
                    1,
                    Math.ceil(this._audio.duration(soundId) * this.getTickRate())
                );
                this._playing.push({
                    soundId,
                    endTick: this._tick + ticks,
                    handle: this._audio.play(soundId),
                });
                return ticks;
            },
            stopSound: (soundId) => this._stopSounds((id) => id === soundId),
            stopAllSounds: () => this._stopSounds(() => true),

            setAnimation: (sprite, name) => {
                const s = asSprite(sprite, "changer l'animation");
                const index = s.asset.animations.findIndex((a) => a.name === name);
                if (index < 0) {
                    throw new ScriptError(
                        `« changer l'animation » : le sprite « ${s.name} » n'a pas d'animation « ${name} ».`
                    );
                }
                const fairyIndex = index + 1;
                const playing = s.animation === fairyIndex && !s.fairy.oAnimation?.bOver;
                if (s.alive && !playing) {
                    s.animation = fairyIndex;
                    s.animationEndFired = false;
                    s.fairy.playAnimation(fairyIndex);
                }
            },
            face: (sprite, side) => {
                const s = asSprite(sprite, 'tourner');
                s.facingLeft = side === 'left';
                const image = this._images.get(
                    `sprite:${s.asset.id}${s.facingLeft ? ':left' : ''}`
                );
                if (image) s.fairy.setImage(image);
            },
            markerPos: (tag, axis, n) => {
                const marker = this._marker(tag, n);
                return (axis === 'x' ? marker.col : marker.row) * ASSET_SIZE;
            },
            markerCount: (tag) => this.level.markers.filter((m) => m.tag.trim() === tag).length,

            vars: (getter) => {
                this._vars = getter;
            },
            hudShow: (textId, visible) => this._hud.setVisible(this._hudText(textId), visible),
            hudSet: (textId, template) =>
                this._hud.setTemplate(this._hudText(textId), String(displayValue(template) ?? '')),
        };
    }
}

/** Convert a block value to a finite number, or explain the problem. */
function num(value: unknown, block: string): number {
    const n = Number(value);
    if (value === undefined || value === null || value === '' || !Number.isFinite(n)) {
        throw new ScriptError(
            `« ${block} » a besoin d'un nombre, mais a reçu « ${String(value)} ». ` +
                'Une variable a-t-elle été oubliée ?'
        );
    }
    return n;
}

/** Check that a block value is a register. */
function asRegister(value: unknown, block: string): Register {
    if (!(value instanceof Register)) {
        throw new ScriptError(
            `« ${block} » a besoin d'un registre : utilise une variable remplie avec « nouveau registre vide ».`
        );
    }
    return value;
}

/** Check that a block value is a sprite. */
function asSprite(value: unknown, block: string): SpriteInstance {
    if (!(value instanceof SpriteInstance)) {
        throw new ScriptError(
            `« ${block} » a besoin d'un sprite : utilise une variable remplie avec « créer le sprite ».`
        );
    }
    return value;
}

function readProp(flight: FairyFlight, prop: SpriteProp): number {
    switch (prop) {
        case 'x':
            return flight.vPosition.x;
        case 'y':
            return flight.vPosition.y;
        case 'vx':
            return flight.vSpeed.x;
        case 'vy':
            return flight.vSpeed.y;
        case 'gravity':
            return flight.vAccel.y;
    }
}

function writeProp(flight: FairyFlight, prop: SpriteProp, value: number): void {
    switch (prop) {
        case 'x':
            flight.vPosition.x = value;
            break;
        case 'y':
            flight.vPosition.y = value;
            break;
        case 'vx':
            flight.vSpeed.x = value;
            break;
        case 'vy':
            flight.vSpeed.y = value;
            break;
        case 'gravity':
            flight.vAccel.y = value;
            break;
    }
}

import { createLevel } from './level';
import { blankPixels } from './pixels';
import { defaultPalette } from './palette';
import { normalizeSoundParams } from './sound';
import { defaultHudText } from './hud';
import { ASSET_SIZE, type KarenProject, type Level } from './model';

/** Palette indices (default palette, DB32 part) used by the starter art. */
const C = {
    black: 1,
    navy: 2,
    brownDark: 4,
    brown: 5,
    tan: 7,
    skin: 8,
    greenLight: 10,
    green: 11,
    greenDark: 13,
    blueDark: 16,
    greyLight: 23,
    grey: 24,
    red: 28,
    pink: 29,
    magenta: 30,
} as const;

/** Small drawing helper over a 32×32 palette-index image. */
class Painter {
    readonly pixels = blankPixels();
    private _seed: number;

    constructor(seed: number) {
        this._seed = seed;
    }

    /** Deterministic pseudo-random number in [0, 1). */
    random(): number {
        this._seed = (this._seed * 1103515245 + 12345) & 0x7fffffff;
        return this._seed / 0x80000000;
    }

    rect(x: number, y: number, w: number, h: number, color: number): this {
        for (let j = y; j < y + h; j++) {
            for (let i = x; i < x + w; i++) {
                if (i >= 0 && j >= 0 && i < ASSET_SIZE && j < ASSET_SIZE) {
                    this.pixels[j * ASSET_SIZE + i] = color;
                }
            }
        }
        return this;
    }

    /** Scatter single pixels of `colors` over a rectangle. */
    speckle(x: number, y: number, w: number, h: number, colors: number[], count: number): this {
        for (let n = 0; n < count; n++) {
            const i = x + Math.floor(this.random() * w);
            const j = y + Math.floor(this.random() * h);
            this.rect(i, j, 1, 1, colors[Math.floor(this.random() * colors.length)]);
        }
        return this;
    }
}

function dirt(): number[] {
    return new Painter(1)
        .rect(0, 0, 32, 32, C.brown)
        .speckle(0, 0, 32, 32, [C.brownDark, C.tan], 70).pixels;
}

function grass(): number[] {
    const p = new Painter(2)
        .rect(0, 0, 32, 32, C.brown)
        .speckle(0, 8, 32, 24, [C.brownDark, C.tan], 55);
    p.rect(0, 0, 32, 7, C.green);
    for (let x = 0; x < 32; x++) {
        p.rect(x, 7, 1, 1 + Math.floor(p.random() * 4), C.green);
    }
    return p.speckle(0, 0, 32, 6, [C.greenLight, C.greenDark], 18).pixels;
}

function brick(): number[] {
    const p = new Painter(3).rect(0, 0, 32, 32, C.grey);
    for (let row = 0; row < 4; row++) {
        const offset = row % 2 === 0 ? 0 : -8;
        for (let x = offset; x < 32; x += 16) {
            p.rect(x, row * 8, 15, 7, C.red);
            p.rect(x, row * 8, 15, 1, C.pink);
        }
    }
    return p.pixels;
}

function platform(): number[] {
    return new Painter(4)
        .rect(0, 0, 32, 10, C.tan)
        .rect(0, 0, 32, 2, C.skin)
        .rect(0, 10, 32, 2, C.brownDark)
        .rect(15, 2, 2, 8, C.brown).pixels;
}

/** The heroine, facing right: `step` 0 = standing, 1 and 2 = walking. */
function heroine(step: 0 | 1 | 2): number[] {
    const p = new Painter(5)
        .rect(9, 2, 14, 6, C.brownDark) // hair
        .rect(7, 4, 4, 12, C.brownDark)
        .rect(11, 6, 12, 9, C.skin) // face
        .rect(19, 9, 2, 2, C.navy) // eye
        .rect(10, 15, 13, 9, C.magenta) // shirt
        .rect(step === 1 ? 22 : 21, 17, 3, 5, C.skin); // arm
    if (step === 0) {
        p.rect(12, 24, 4, 8, C.blueDark).rect(18, 24, 4, 8, C.blueDark);
    } else if (step === 1) {
        p.rect(10, 24, 4, 7, C.blueDark).rect(19, 24, 4, 8, C.blueDark);
    } else {
        p.rect(13, 24, 4, 8, C.blueDark).rect(16, 24, 4, 7, C.blueDark);
    }
    return p.pixels;
}

/** Starter level: ground, a pit, platforms and a brick wall. BOB ids: see `newProject`. */
function starterLevel(): Level {
    const level = createLevel(1, 'Niveau 1', 60, 15);
    const put = (bob: number, c0: number, c1: number, r0: number, r1 = r0) => {
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                level.tiles[r * level.cols + c] = bob;
            }
        }
    };
    put(1, 0, 59, 12); // grass
    put(2, 0, 59, 13, 14); // dirt
    put(0, 22, 24, 12, 14); // pit
    put(4, 7, 10, 9); // platforms
    put(4, 13, 16, 6);
    put(4, 27, 31, 9);
    put(3, 36, 37, 10, 11); // brick wall
    put(3, 45, 49, 7);
    return level;
}

/**
 * Starter scripts, as a Blockly workspace: at each level start, create the heroine
 * (gravity, camera); run with ← → (facing and walking animation); jump with space
 * when on the ground.
 */
function starterCode(): object {
    const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
    const player = { block: { type: 'variables_get', fields: { VAR: { id: 'var_joueur' } } } };
    const setProp = (prop: string, value: number, next?: object) => ({
        type: 'karen_sprite_set',
        fields: { PROP: prop },
        inputs: { SPRITE: player, VALUE: num(value) },
        ...(next ? { next: { block: next } } : {}),
    });
    const animate = (name: string) => ({
        type: 'karen_sprite_animate',
        fields: { ANIM: name },
        inputs: { SPRITE: player },
    });
    const face = (side: 'left' | 'right', next: object) => ({
        type: 'karen_sprite_face',
        fields: { SIDE: side },
        inputs: { SPRITE: player },
        next: { block: next },
    });
    const keyDown = (key: number) => ({
        block: { type: 'karen_key_down', fields: { KEY: String(key) } },
    });
    return {
        blocks: {
            languageVersion: 0,
            blocks: [
                {
                    type: 'karen_on_level_start',
                    x: 20,
                    y: 20,
                    next: {
                        block: {
                            type: 'variables_set',
                            fields: { VAR: { id: 'var_joueur' } },
                            inputs: {
                                VALUE: {
                                    block: {
                                        type: 'karen_sprite_create',
                                        fields: { SPRITE: '1' },
                                        inputs: { X: num(64), Y: num(300) },
                                    },
                                },
                            },
                            next: {
                                block: setProp('gravity', 1, {
                                    type: 'karen_camera_follow',
                                    inputs: { SPRITE: player },
                                }),
                            },
                        },
                    },
                },
                {
                    type: 'karen_on_tick',
                    x: 20,
                    y: 320,
                    next: {
                        block: {
                            type: 'controls_if',
                            extraState: { elseIfCount: 1, hasElse: true },
                            inputs: {
                                IF0: keyDown(37),
                                DO0: { block: setProp('vx', -5, face('left', animate('marche'))) },
                                IF1: keyDown(39),
                                DO1: { block: setProp('vx', 5, face('right', animate('marche'))) },
                                ELSE: { block: setProp('vx', 0, animate('repos')) },
                            },
                        },
                    },
                },
                {
                    type: 'karen_on_key',
                    x: 20,
                    y: 980,
                    fields: { KEY: '32', STATE: 'down' },
                    next: {
                        block: {
                            type: 'controls_if',
                            inputs: {
                                IF0: {
                                    block: {
                                        type: 'karen_sprite_touching',
                                        fields: { SIDE: 'bottom' },
                                        inputs: { SPRITE: player },
                                    },
                                },
                                DO0: {
                                    block: setProp('vy', -14, {
                                        type: 'karen_sound_play',
                                        fields: { SOUND: '1' },
                                    }),
                                },
                            },
                        },
                    },
                },
            ],
        },
        variables: [{ name: 'joueur', id: 'var_joueur' }],
    };
}

/** A new project with starter content: a few BOB, a heroine, a level and her scripts. */
export function newProject(): KarenProject {
    return {
        name: 'Mon jeu',
        settings: { tickRate: 30 },
        palette: defaultPalette(),
        bobs: [
            { id: 1, name: 'Herbe', collision: 'solid', frames: [grass()], frameDuration: 8 },
            { id: 2, name: 'Terre', collision: 'solid', frames: [dirt()], frameDuration: 8 },
            { id: 3, name: 'Brique', collision: 'solid', frames: [brick()], frameDuration: 8 },
            {
                id: 4,
                name: 'Plateforme',
                collision: 'platform',
                frames: [platform()],
                frameDuration: 8,
            },
        ],
        sprites: [
            {
                id: 1,
                name: 'Héroïne',
                tag: 'joueur',
                frames: [heroine(0), heroine(1), heroine(2)],
                animations: [
                    { name: 'repos', frames: [0], frameDuration: 8, loop: true },
                    { name: 'marche', frames: [1, 0, 2, 0], frameDuration: 4, loop: true },
                ],
            },
        ],
        hud: [
            { ...defaultHudText(1), name: 'niveau', template: '{{niveau}}', size: 14 },
            {
                ...defaultHudText(2),
                name: 'temps',
                template: 'Temps : {{temps}}',
                anchor: 'top-right',
                size: 14,
                color: '#fbf236',
            },
        ],
        sounds: [
            {
                id: 1,
                name: 'saut',
                params: normalizeSoundParams({
                    wave_type: 0,
                    p_base_freq: 0.4,
                    p_freq_ramp: 0.2,
                    p_env_sustain: 0.2,
                    p_env_decay: 0.2,
                    p_duty: 0.3,
                    sound_vol: 0.4,
                }),
            },
            {
                id: 2,
                name: 'trésor',
                params: normalizeSoundParams({
                    wave_type: 1,
                    p_base_freq: 0.6,
                    p_env_sustain: 0.05,
                    p_env_decay: 0.3,
                    p_env_punch: 0.45,
                    p_arp_speed: 0.6,
                    p_arp_mod: 0.35,
                    sound_vol: 0.4,
                }),
            },
        ],
        levels: [starterLevel()],
        code: starterCode(),
    };
}

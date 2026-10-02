import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FairyKeys } from '@fairy/FairyKeys';
import { newProject } from '@project/defaults';
import { createLevel } from '@project/level';
import { blankPixels } from '@project/pixels';
import type { KarenProject } from '@project/model';
import { GameRuntime } from '@runtime/GameRuntime';
import type { ProjectGame } from '@runtime/ProjectGame';
import {
    blk,
    compare,
    getVar,
    hat,
    ifThen,
    num,
    setVar,
    stmts,
    txt,
    val,
    workspace,
} from '../helpers/blocks';
import { installFakeCanvas, installFakeClock, key, type FakeClock } from './fakes';

const SETUP_TICKS = 3;
const HEROINE = 1;
const COIN = 2;
const BRICK = 3;

/** `créer le sprite <asset> en x y`, optionally with gravity, stored in variable `name`. */
const create = (asset: number, x: number, y: number) =>
    val(
        blk('karen_sprite_create', {
            fields: { SPRITE: String(asset) },
            inputs: { X: num(x), Y: num(y) },
        })
    );
const setGravity = (sprite: object, g: number) =>
    blk('karen_sprite_set', {
        fields: { PROP: 'gravity' },
        inputs: { SPRITE: sprite, VALUE: num(g) },
    });

/** Starter project with a coin sprite, a second level, and the given scripts. */
function project(code: object): KarenProject {
    const p = newProject();
    p.sprites.push({ id: COIN, name: 'Pièce', tag: 'piece', pixels: blankPixels() });
    const level2 = createLevel(2, 'Niveau 2', 30, 15);
    level2.tiles.fill(BRICK, 12 * 30); // brick floor on rows 12–14
    p.levels.push(level2);
    p.code = code;
    return p;
}

describe('Blocs J3 (intégration)', () => {
    let clock: FakeClock;
    let canvas: HTMLCanvasElement;
    let runtime: GameRuntime;
    let errors: string[];

    beforeEach(() => {
        installFakeCanvas();
        clock = installFakeClock();
        canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        document.body.appendChild(canvas);
        runtime = new GameRuntime();
        errors = [];
        runtime.onScriptError = (m) => errors.push(m);
        runtime.onError = (m) => errors.push(`FATAL ${m}`);
    });

    afterEach(() => {
        runtime.stop();
        canvas.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function play(p: KarenProject): ProjectGame {
        expect(runtime.start(canvas, canvas, p)).toBe(true);
        clock.frame(0);
        clock.ticks(SETUP_TICKS);
        return runtime.game!;
    }

    it('« aller au niveau » change de niveau, vide les sprites et relance « quand le niveau commence »', () => {
        const game = play(
            project(
                workspace(
                    [
                        hat('karen_on_level_start', {}, setVar('h', create(HEROINE, 64, 300))),
                        hat(
                            'karen_on_key',
                            { KEY: String(FairyKeys.ALPHANUM.N), STATE: 'down' },
                            blk('karen_level_goto', { fields: { LEVEL: '2' } })
                        ),
                    ],
                    ['h']
                )
            )
        );
        clock.ticks(2);
        expect(game.level.name).toBe('Niveau 1');
        const first = game.sprites[0];
        expect(game.sprites).toHaveLength(1);

        key(canvas, 'keydown', FairyKeys.ALPHANUM.N);
        clock.ticks(2);
        expect(game.level.name).toBe('Niveau 2');
        expect(first.alive).toBe(false);
        expect(game.sprites).toHaveLength(1);
        expect(game.sprites[0]).not.toBe(first);
        expect(errors).toEqual([]);
    });

    it('« mettre la case » modifie le niveau et « la case est » le lit', () => {
        const tileIs = (col: number, row: number, bob: number) =>
            val(
                blk('karen_level_tile_is', {
                    fields: { BOB: String(bob) },
                    inputs: { X: num(col), Y: num(row) },
                })
            );
        const game = play(
            project(
                workspace(
                    [
                        hat(
                            'karen_on_level_start',
                            {},
                            blk('karen_level_set_tile', {
                                fields: { BOB: String(BRICK) },
                                inputs: { X: num(2), Y: num(3) },
                            }),
                            // Outside the level: silently ignored.
                            blk('karen_level_set_tile', {
                                fields: { BOB: String(BRICK) },
                                inputs: { X: num(999), Y: num(0) },
                            }),
                            ifThen(tileIs(2, 3, BRICK), setVar('a', create(HEROINE, 0, 0))),
                            ifThen(tileIs(4, 3, BRICK), setVar('b', create(HEROINE, 0, 0)))
                        ),
                    ],
                    ['a', 'b']
                )
            )
        );
        clock.ticks(2);
        expect(game.sprites).toHaveLength(1);
        expect(errors).toEqual([]);
    });

    it('« quand un sprite … touche un bloc solide » s’exécute pour ce sprite', () => {
        const game = play(
            project(
                workspace(
                    [
                        hat(
                            'karen_on_level_start',
                            {},
                            setVar('h', create(HEROINE, 64, 200)),
                            setGravity(getVar('h'), 1)
                        ),
                        hat(
                            'karen_on_sprite_tile',
                            { TAG: 'joueur' },
                            blk('karen_sprite_destroy', {
                                inputs: { SPRITE: val(blk('karen_event_self')) },
                            })
                        ),
                    ],
                    ['h']
                )
            )
        );
        clock.ticks(5);
        expect(game.sprites).toHaveLength(1); // still falling
        clock.ticks(40);
        expect(game.sprites).toHaveLength(0); // landed → destroyed by its event
        expect(errors).toEqual([]);
    });

    it('« quand un sprite … touche un sprite … » et un registre comptent les pièces', () => {
        const scoreIs = (n: number) =>
            compare(
                val(blk('karen_dict_get', { inputs: { KEY: txt('pièces'), DICT: getVar('r') } })),
                'EQ',
                num(n)
            );
        const game = play(
            project(
                workspace(
                    [
                        hat(
                            'karen_on_level_start',
                            {},
                            setVar('r', val(blk('karen_dict_create'))),
                            setVar('h', create(HEROINE, 100, 300)),
                            setVar('c', create(COIN, 110, 300))
                        ),
                        hat(
                            'karen_on_sprite_sprite',
                            { TAG: 'joueur', OTHER: 'piece' },
                            blk('karen_sprite_destroy', {
                                inputs: { SPRITE: val(blk('karen_event_other')) },
                            }),
                            blk('karen_dict_change', {
                                inputs: { KEY: txt('pièces'), DICT: getVar('r'), VALUE: num(1) },
                            }),
                            ifThen(scoreIs(1), setVar('c', create(COIN, 1000, 0)))
                        ),
                    ],
                    ['r', 'h', 'c']
                )
            )
        );
        clock.ticks(4);
        expect(errors).toEqual([]);
        expect(game.sprites.map((s) => s.name)).toEqual(['Héroïne', 'Pièce']);
        expect(game.sprites[1].fairy.oFlight.vPosition.x).toBe(1000);
    });

    it('signale une fonction qui s’appelle sans fin, sans arrêter le jeu', () => {
        play(
            project(
                workspace([
                    {
                        type: 'procedures_defnoreturn',
                        fields: { NAME: 'encore' },
                        inputs: {
                            STACK: stmts({
                                type: 'procedures_callnoreturn',
                                extraState: { name: 'encore' },
                            }),
                        },
                    },
                    hat(
                        'karen_on_start',
                        {},
                        { type: 'procedures_callnoreturn', extraState: { name: 'encore' } }
                    ),
                ])
            )
        );
        clock.ticks(2);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/quand le jeu démarre/);
        expect(errors[0]).toMatch(/sans fin|ne rend jamais la main/);
        expect(runtime.running).toBe(true);
    });

    it('« ce sprite » hors d’un événement de sprite donne un message clair', () => {
        play(
            project(
                workspace([
                    hat(
                        'karen_on_start',
                        {},
                        blk('karen_sprite_destroy', {
                            inputs: { SPRITE: val(blk('karen_event_self')) },
                        })
                    ),
                ])
            )
        );
        clock.ticks(2);
        expect(errors[0]).toMatch(/ne marche que sous un événement/);
    });
});

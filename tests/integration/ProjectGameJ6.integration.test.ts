import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FairyKeys } from '@fairy/FairyKeys';
import type { FairyMatrix } from '@fairy/FairyMatrix';
import { newProject } from '@project/defaults';
import { placeMarker } from '@project/level';
import type { KarenProject } from '@project/model';
import { GameRuntime } from '@runtime/GameRuntime';
import type { ProjectGame } from '@runtime/ProjectGame';
import { blk, compare, getVar, hat, ifThen, num, setVar, val, workspace } from '../helpers/blocks';
import { installFakeCanvas, installFakeClock, key, type FakeClock } from './fakes';

const HEROINE = '1';
const create = (x: number, y: number) =>
    val(
        blk('karen_sprite_create', {
            fields: { SPRITE: HEROINE },
            inputs: { X: num(x), Y: num(y) },
        })
    );
const animate = (name: string, sprite = getVar('h')) =>
    blk('karen_sprite_animate', { fields: { ANIM: name }, inputs: { SPRITE: sprite } });

describe('Blocs J6 : animations, orientation, marqueurs, BOB animés (intégration)', () => {
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
        clock.ticks(3);
        return runtime.game!;
    }

    const withCode = (code: object, edit: (p: KarenProject) => void = () => {}) => {
        const p = { ...newProject(), code };
        edit(p);
        return p;
    };

    it('un sprite joue sa première animation à sa création, puis « changer l’animation »', () => {
        const game = play(
            withCode(
                workspace(
                    [
                        hat('karen_on_level_start', {}, setVar('h', create(64, 0))),
                        hat(
                            'karen_on_key',
                            { KEY: String(FairyKeys.SPACE), STATE: 'down' },
                            animate('marche')
                        ),
                    ],
                    ['h']
                )
            )
        );
        clock.ticks(1);
        const h = game.sprites[0];
        expect(h.animation).toBe(1); // « repos »
        key(canvas, 'keydown', FairyKeys.SPACE);
        clock.ticks(1);
        expect(h.animation).toBe(2); // « marche »
        const frames = new Set<number>();
        for (let i = 0; i < 16; i++) {
            clock.ticks(1);
            frames.add(h.fairy.oAnimation!.nFrameIndex);
        }
        expect(frames.size).toBe(4); // the 4 images of « marche » play in turn
        expect(errors).toEqual([]);
    });

    it('changer vers l’animation en cours ne la relance pas', () => {
        const game = play(
            withCode(
                workspace(
                    [
                        hat(
                            'karen_on_level_start',
                            {},
                            setVar('h', create(64, 0)),
                            animate('marche')
                        ),
                        hat('karen_on_tick', {}, animate('marche')),
                    ],
                    ['h']
                )
            )
        );
        clock.ticks(9);
        expect(game.sprites[0].fairy.oAnimation!.nFrameIndex).toBeGreaterThan(0);
    });

    it('« animation terminée » se déclenche une fois à la fin d’une animation sans boucle', () => {
        const game = play(
            withCode(
                workspace(
                    [
                        hat(
                            'karen_on_level_start',
                            {},
                            setVar('h', create(64, 0)),
                            animate('marche')
                        ),
                        hat(
                            'karen_on_animation_end',
                            { TAG: 'joueur' },
                            setVar('c', create(500, 0))
                        ),
                    ],
                    ['h', 'c']
                ),
                (p) => (p.sprites[0].animations[1].loop = false) // marche: 4 images × 4 ticks
            )
        );
        clock.ticks(10);
        expect(game.sprites).toHaveLength(1);
        clock.ticks(10); // past 16 ticks: the animation is over
        expect(game.sprites).toHaveLength(2);
        expect(game.sprites[0].fairy.oAnimation!.nFrameIndex).toBe(3); // stays on the last image
        clock.ticks(30);
        expect(game.sprites).toHaveLength(2); // fired only once
        expect(errors).toEqual([]);
    });

    it('« tourner vers la gauche » dessine le sprite retourné', () => {
        const game = play(
            withCode(
                workspace(
                    [
                        hat(
                            'karen_on_level_start',
                            {},
                            setVar('h', create(64, 0)),
                            blk('karen_sprite_face', {
                                fields: { SIDE: 'left' },
                                inputs: { SPRITE: getVar('h') },
                            })
                        ),
                    ],
                    ['h']
                )
            )
        );
        clock.ticks(1);
        const h = game.sprites[0];
        expect(h.facingLeft).toBe(true);
        expect(h.fairy.oImage).not.toBe(
            (game as unknown as { _images: { get(id: string): unknown } })._images.get('sprite:1')
        );
    });

    it('marqueurs : position, nombre, et « touche le marqueur »', () => {
        const markerX = (n: number) =>
            val(
                blk('karen_marker_pos', {
                    fields: { AXIS: 'x', MARKER: 'pièce' },
                    inputs: { N: num(n) },
                })
            );
        const count = val(blk('karen_marker_count', { fields: { MARKER: 'pièce' } }));
        const game = play(
            withCode(
                workspace(
                    [
                        hat(
                            'karen_on_level_start',
                            {},
                            ifThen(compare(count, 'EQ', num(2)), setVar('h', create(0, 0))),
                            setVar('x', markerX(2))
                        ),
                        hat(
                            'karen_on_sprite_marker',
                            { TAG: 'joueur', MARKER: 'sortie' },
                            blk('karen_sprite_destroy', {
                                inputs: { SPRITE: val(blk('karen_event_self')) },
                            })
                        ),
                        hat(
                            'karen_on_key',
                            { KEY: String(FairyKeys.SPACE), STATE: 'down' },
                            blk('karen_sprite_set', {
                                fields: { PROP: 'x' },
                                inputs: { SPRITE: getVar('h'), VALUE: markerX(2) },
                            })
                        ),
                    ],
                    ['h', 'x']
                ),
                (p) => {
                    placeMarker(p.levels[0], 3, 2, 'pièce');
                    placeMarker(p.levels[0], 12, 2, 'pièce');
                    // No gravity in this test: the heroine stays on row 0.
                    placeMarker(p.levels[0], 12, 0, 'sortie');
                }
            )
        );
        clock.ticks(2);
        expect(errors).toEqual([]);
        expect(game.sprites).toHaveLength(1); // 2 coin markers → heroine created
        key(canvas, 'keydown', FairyKeys.SPACE); // move her to coin n° 2: column 12
        clock.ticks(1);
        expect(game.sprites[0].fairy.oFlight.vPosition.x).toBe(12 * 32);
        clock.ticks(2); // she is now on the « sortie » marker: destroyed by its event
        expect(game.sprites).toHaveLength(0);
    });

    it('un marqueur absent donne un message clair', () => {
        play(
            withCode(
                workspace(
                    [
                        hat(
                            'karen_on_start',
                            {},
                            setVar(
                                'x',
                                val(
                                    blk('karen_marker_pos', {
                                        fields: { AXIS: 'x', MARKER: 'trésor' },
                                        inputs: { N: num(1) },
                                    })
                                )
                            )
                        ),
                    ],
                    ['x']
                ),
                // « trésor » only exists in another level: the menu accepts it, the game does not.
                (p) => {
                    const other = { ...structuredClone(p.levels[0]), id: 9, name: 'Autre' };
                    placeMarker(other, 0, 0, 'trésor');
                    p.levels.push(other);
                }
            )
        );
        clock.ticks(1);
        expect(errors[0]).toMatch(/n'a pas de marqueur « trésor »/);
    });

    it('un BOB animé change d’image dans le niveau', () => {
        const game = play(
            withCode(workspace([]), (p) => {
                p.bobs[0].frames.push([...p.bobs[1].frames[0]]); // grass ↔ dirt
                p.bobs[0].frameDuration = 2;
            })
        );
        const matrix = (game as unknown as { _matrix: FairyMatrix })._matrix;
        const tile = matrix.getTile(0, 12); // grass row
        const seen = new Set<number>();
        for (let i = 0; i < 6; i++) {
            clock.ticks(1);
            seen.add(tile.nGfx);
        }
        expect(seen).toEqual(new Set([1, 2]));
    });
});

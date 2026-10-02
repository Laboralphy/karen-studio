import { describe, expect, it } from 'vitest';
import { compileProject } from '@blocks/compile';
import { newProject } from '@project/defaults';
import { Scheduler, type ScriptCoroutine } from '@runtime/Scheduler';
import { blk, getVar, hat, setVar, val, workspace as ws } from '../helpers/blocks';

const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });

/** A workspace with the given top blocks and variables. */
function workspace(blocks: object[], variables: { name: string; id: string }[] = []) {
    return {
        code: { blocks: { languageVersion: 0, blocks }, variables },
        sprites: [],
        bobs: [],
        levels: [],
    };
}

/** Run compiled code with a minimal API; returns the registered start scripts and a log. */
function load(code: string) {
    const scheduler = new Scheduler();
    const log: unknown[] = [];
    const api = {
        onStart: (label: string, run: () => ScriptCoroutine) => scheduler.spawn(label, run()),
        onTick: () => {},
        onKey: () => {},
        ticks: (s: number) => Math.round(s * 30),
        guard: () => scheduler.guard(),
        log: (v: unknown) => log.push(v),
    };
    new Function('__k', code)(api);
    return { scheduler, log };
}

describe('compilation des blocs', () => {
    it('compile le projet de départ', () => {
        const code = compileProject(newProject());
        expect(code).toContain('__k.onLevelStart(');
        expect(code).toContain('__k.onTick(');
        expect(code).toContain('__k.onKey(32, "down"');
        expect(code).toContain('__k.createSprite(1, 64, 300)');
        expect(() => new Function('__k', code)).not.toThrow();
    });

    it('un projet sans code ne produit rien', () => {
        expect(compileProject({ code: null, sprites: [], bobs: [], levels: [] })).toBe('');
    });

    it('ignore les blocs qui ne sont pas sous un événement', () => {
        const code = compileProject(
            workspace([{ type: 'karen_camera_move', x: 0, y: 0, inputs: { X: num(1), Y: num(2) } }])
        );
        expect(code).not.toContain('cameraMoveTo');
    });

    it('une boucle « répéter » fait une pause à chaque tour, comme Scratch', () => {
        const code = compileProject(
            workspace(
                [
                    {
                        type: 'karen_on_start',
                        next: {
                            block: {
                                type: 'controls_repeat_ext',
                                inputs: {
                                    TIMES: num(3),
                                    DO: {
                                        block: {
                                            type: 'math_change',
                                            fields: { VAR: { id: 'n' } },
                                            inputs: { DELTA: num(1) },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
                [{ name: 'compteur', id: 'n' }]
            )
        );
        expect(code).toMatch(/__k\.guard\(\);[\s\S]*yield;\n\s*\}/);
        const { scheduler } = load(code + '\n__k.log(compteur);');
        // The script runs one iteration per tick: 3 ticks, then it finishes.
        scheduler.tick();
        scheduler.tick();
        expect(scheduler.count).toBe(1);
        scheduler.tick();
        scheduler.tick();
        expect(scheduler.count).toBe(0);
    });

    it('« attendre » met le script en pause pendant le bon nombre de ticks', () => {
        const code = compileProject(
            workspace([
                {
                    type: 'karen_on_start',
                    next: { block: { type: 'karen_wait', inputs: { SECONDS: num(0.1) } } },
                },
            ])
        );
        expect(code).toContain('yield __k.ticks(0.1);');
        const { scheduler } = load(code);
        scheduler.tick(); // runs until the wait (3 ticks at 30/s)
        scheduler.tick();
        scheduler.tick();
        expect(scheduler.count).toBe(1);
        scheduler.tick();
        expect(scheduler.count).toBe(0);
    });

    it('nomme chaque script d’après son événement, pour les messages d’erreur', () => {
        const code = compileProject(
            workspace([{ type: 'karen_on_key', fields: { KEY: '65', STATE: 'up' } }])
        );
        expect(code).toContain('"quand la touche A est relâchée"');
    });
});

describe('compilation des blocs (J3)', () => {
    it('une fonction avec paramètre et retour devient une coroutine appelée par yield*', () => {
        const project = {
            code: ws(
                [
                    {
                        type: 'procedures_defreturn',
                        fields: { NAME: 'double' },
                        extraState: { params: [{ name: 'n', id: 'n' }] },
                        inputs: {
                            RETURN: val(
                                blk('math_arithmetic', {
                                    fields: { OP: 'MULTIPLY' },
                                    inputs: { A: getVar('n'), B: num(2) },
                                })
                            ),
                        },
                    },
                    hat(
                        'karen_on_start',
                        {},
                        setVar(
                            'x',
                            val({
                                type: 'procedures_callreturn',
                                extraState: { name: 'double', params: ['n'] },
                                inputs: { ARG0: num(21) },
                            })
                        )
                    ),
                ],
                ['x', 'n']
            ),
            sprites: [],
            bobs: [],
            levels: [],
        };
        const code = compileProject(project);
        expect(code).toContain('function* double(n)');
        expect(code).toContain('(yield* double(21))');
        const api: { peek?: () => unknown } = {};
        const scheduler = new Scheduler();
        new Function('__k', `${code}\n__k.peek = () => x;`)(
            Object.assign(api, {
                onStart: (label: string, run: () => ScriptCoroutine) =>
                    scheduler.spawn(label, run()),
                guard: () => scheduler.guard(),
            })
        );
        scheduler.tick();
        expect(api.peek!()).toBe(42);
    });

    it('« ce sprite » hors d’un événement de sprite produit une erreur explicite', () => {
        const code = compileProject({
            code: ws([
                hat(
                    'karen_on_start',
                    {},
                    blk('karen_sprite_destroy', {
                        inputs: { SPRITE: val(blk('karen_event_self')) },
                    })
                ),
            ]),
            sprites: [],
            bobs: [],
            levels: [],
        });
        expect(code).toContain('__k.noEventSprite("ce sprite")');
    });

    it('les événements de sprites reçoivent « ce sprite » et « l’autre sprite »', () => {
        const sprites = [
            { id: 1, name: 'A', tag: 'joueur', pixels: [] },
            { id: 2, name: 'B', tag: 'piece', pixels: [] },
        ];
        const code = compileProject({
            code: ws([
                hat(
                    'karen_on_sprite_sprite',
                    { TAG: 'joueur', OTHER: 'piece' },
                    blk('karen_sprite_destroy', {
                        inputs: { SPRITE: val(blk('karen_event_other')) },
                    })
                ),
            ]),
            sprites,
            bobs: [],
            levels: [],
        });
        expect(code).toContain(
            '__k.onSpriteSprite("joueur", "piece", "quand un sprite joueur touche un sprite piece", function* (__self, __other)'
        );
        expect(code).toContain('__k.destroySprite(__other);');
    });
});

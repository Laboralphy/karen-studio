import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FairyKeys } from '@fairy/FairyKeys';
import { compileProject } from '@blocks/compile';
import { newProject } from '@project/defaults';
import { defaultHudText } from '@project/hud';
import type { KarenProject } from '@project/model';
import { GameRuntime } from '@runtime/GameRuntime';
import { blk, getVar, hat, num, setVar, txt, val, workspace } from '../helpers/blocks';
import { installFakeCanvas, installFakeClock, key, type FakeClock } from './fakes';

describe('Interface en jeu (intégration)', () => {
    let clock: FakeClock;
    let canvas: HTMLCanvasElement;
    let host: HTMLDivElement;
    let runtime: GameRuntime;
    let errors: string[];

    beforeEach(() => {
        installFakeCanvas();
        clock = installFakeClock();
        canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        host = document.createElement('div');
        document.body.append(canvas, host);
        runtime = new GameRuntime();
        errors = [];
        runtime.onScriptError = (m) => errors.push(m);
        runtime.onError = (m) => errors.push(`FATAL ${m}`);
    });

    afterEach(() => {
        runtime.stop();
        canvas.remove();
        host.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function play(p: KarenProject): void {
        expect(runtime.start(canvas, canvas, p, host)).toBe(true);
        clock.frame(0);
        clock.ticks(3);
    }

    const texts = () => [...host.children].map((e) => (e as HTMLElement).textContent);

    it('le projet de départ affiche le niveau et le temps qui passe', () => {
        play(newProject());
        clock.ticks(1);
        expect(texts()).toEqual(['Niveau 1', 'Temps : 0']);
        clock.ticks(30); // one second at 30 ticks/s
        expect(texts()).toEqual(['Niveau 1', 'Temps : 1']);
    });

    it('affiche les variables des blocs et un registre, et les blocs Interface agissent', () => {
        const p = newProject();
        p.hud = [
            {
                ...defaultHudText(1),
                name: 'score',
                template: 'Score : {{score}} · Or : {{sac.or}}',
            },
            { ...defaultHudText(2), name: 'fin', template: 'GAME OVER', visible: false },
        ];
        p.code = workspace(
            [
                hat(
                    'karen_on_start',
                    {},
                    setVar('score', num(10)),
                    setVar('sac', val(blk('karen_dict_create'))),
                    blk('karen_dict_set', {
                        inputs: { KEY: txt('or'), DICT: getVar('sac'), VALUE: num(2.5) },
                    })
                ),
                hat(
                    'karen_on_key',
                    { KEY: String(FairyKeys.SPACE), STATE: 'down' },
                    blk('karen_hud_show', { fields: { MODE: 'show', TEXT: '2' } }),
                    blk('karen_hud_set', {
                        fields: { TEXT: '1' },
                        inputs: { VALUE: txt('Bravo, {{score}} points !') },
                    })
                ),
            ],
            ['score', 'sac']
        );
        play(p);
        clock.ticks(1);
        const [score, over] = [...host.children] as HTMLElement[];
        expect(score.textContent).toBe('Score : 10 · Or : 2.5');
        expect(over.hidden).toBe(true);

        key(canvas, 'keydown', FairyKeys.SPACE);
        clock.ticks(1);
        expect(over.hidden).toBe(false);
        expect(score.textContent).toBe('Bravo, 10 points !');
        expect(errors).toEqual([]);
    });

    it('le code compilé donne accès aux variables par leur nom', () => {
        // Blockly ids differ from names in real projects (e.g. 'var_joueur' for « joueur »).
        const code = compileProject({
            code: {
                blocks: { languageVersion: 0, blocks: [] },
                variables: [
                    { name: 'score', id: 'id_1' },
                    { name: 'mes vies', id: 'id_2' },
                ],
            },
            sprites: [],
            bobs: [],
            levels: [],
            sounds: [],
        });
        expect(code).toMatch(
            /__k\.vars\(function \(\) \{\s*return \{ "score": score, "mes vies": mes_vies \};/
        );
    });

    it('Stop retire les textes de l’écran', () => {
        play(newProject());
        clock.ticks(1);
        expect(host.children.length).toBe(2);
        runtime.stop();
        expect(host.children.length).toBe(0);
    });
});

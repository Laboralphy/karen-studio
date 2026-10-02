import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FairyKeys } from '@fairy/FairyKeys';
import { newProject } from '@project/defaults';
import type { KarenProject } from '@project/model';
import { ProjectGame } from '@runtime/ProjectGame';
import { compileProject } from '@blocks/compile';
import { SoundPlayer, type SoundHandle } from '@runtime/SoundPlayer';
import { blk, hat, num, setVar, val, workspace } from '../helpers/blocks';
import { installFakeCanvas, installFakeClock, key, type FakeClock } from './fakes';

const JUMP = 1;

/** Silent player that records what is played and stopped, with fixed 0.5 s sounds. */
class FakePlayer extends SoundPlayer {
    played: number[] = [];
    stopped: number[] = [];
    constructor() {
        super(null);
    }
    override has(): boolean {
        return true;
    }
    override duration(): number {
        return 0.5; // 15 ticks at 30 ticks/s
    }
    override play(id: number): SoundHandle {
        this.played.push(id);
        return { stop: () => this.stopped.push(id) };
    }
}

describe('Blocs son (intégration)', () => {
    let clock: FakeClock;
    let canvas: HTMLCanvasElement;
    let game: ProjectGame;
    let player: FakePlayer;
    let errors: string[];

    beforeEach(() => {
        installFakeCanvas();
        clock = installFakeClock();
        canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        document.body.appendChild(canvas);
        errors = [];
    });

    afterEach(() => {
        game?.destroy();
        canvas.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function play(code: object): void {
        const project: KarenProject = { ...newProject(), code };
        player = new FakePlayer();
        game = new ProjectGame(project, compileProject(project), player);
        game.onScriptError = (m) => errors.push(m);
        game.setCanvas(canvas);
        game.setInputTarget(canvas);
        game.start();
        clock.frame(0);
        clock.ticks(3);
    }

    const playSound = (type: string) => blk(type, { fields: { SOUND: String(JUMP) } });
    const create = (x: number) =>
        val(
            blk('karen_sprite_create', {
                fields: { SPRITE: '1' },
                inputs: { X: num(x), Y: num(0) },
            })
        );

    it('« jouer le son jusqu’au bout » attend la fin du son, puis « son terminé » se déclenche', () => {
        play(
            workspace(
                [
                    hat(
                        'karen_on_start',
                        {},
                        playSound('karen_sound_play_wait'),
                        setVar('a', create(0))
                    ),
                    hat('karen_on_sound_end', { SOUND: String(JUMP) }, setVar('b', create(100))),
                ],
                ['a', 'b']
            )
        );
        clock.ticks(1);
        expect(player.played).toEqual([JUMP]);
        expect(game.sprites).toHaveLength(0);
        clock.ticks(14);
        expect(game.sprites).toHaveLength(0);
        clock.ticks(2); // 15 ticks later: the wait is over and the end event fired
        expect(game.sprites).toHaveLength(2);
        expect(errors).toEqual([]);
    });

    it('arrêter un son le coupe sans déclencher « son terminé »', () => {
        play(
            workspace(
                [
                    hat('karen_on_start', {}, playSound('karen_sound_play')),
                    hat(
                        'karen_on_key',
                        { KEY: String(FairyKeys.SPACE), STATE: 'down' },
                        playSound('karen_sound_stop')
                    ),
                    hat('karen_on_sound_end', { SOUND: String(JUMP) }, setVar('b', create(100))),
                ],
                ['b']
            )
        );
        clock.ticks(2);
        key(canvas, 'keydown', FairyKeys.SPACE);
        clock.ticks(1);
        expect(player.stopped).toEqual([JUMP]);
        clock.ticks(30);
        expect(game.sprites).toHaveLength(0);
    });

    it('« arrêter tous les sons » coupe tout ; la fin de partie aussi', () => {
        play(
            workspace([
                hat(
                    'karen_on_start',
                    {},
                    playSound('karen_sound_play'),
                    playSound('karen_sound_play'),
                    blk('karen_sound_stop_all')
                ),
            ])
        );
        clock.ticks(1);
        expect(player.stopped).toEqual([JUMP, JUMP]);

        play(workspace([hat('karen_on_start', {}, playSound('karen_sound_play'))]));
        clock.ticks(1);
        game.destroy();
        expect(player.stopped).toEqual([JUMP]);
    });
});

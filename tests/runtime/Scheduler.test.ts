import { describe, expect, it, vi } from 'vitest';
import {
    Scheduler,
    ScriptStepLimitError,
    type ScriptCoroutine,
    type ScriptThread,
} from '@runtime/Scheduler';

describe('Scheduler', () => {
    it('exécute les scripts dans l’ordre de création, une étape par tick', () => {
        const s = new Scheduler();
        const log: string[] = [];
        s.spawn(
            'a',
            (function* () {
                log.push('a1');
                yield;
                log.push('a2');
            })()
        );
        s.spawn(
            'b',
            (function* () {
                log.push('b1');
                yield;
                log.push('b2');
            })()
        );
        s.tick();
        expect(log).toEqual(['a1', 'b1']);
        s.tick();
        expect(log).toEqual(['a1', 'b1', 'a2', 'b2']);
        expect(s.count).toBe(0);
    });

    it('« attendre n ticks » reprend exactement n ticks plus tard', () => {
        const s = new Scheduler();
        let resumedAt = -1;
        let tick = 0;
        s.spawn(
            'w',
            (function* () {
                yield 3;
                resumedAt = tick;
            })()
        );
        for (tick = 0; tick < 6; tick++) {
            s.tick();
        }
        expect(resumedAt).toBe(3);
    });

    it('lance dans le même tick un script créé par un autre script', () => {
        const s = new Scheduler();
        const log: string[] = [];
        s.spawn(
            'parent',
            (function* () {
                s.spawn(
                    'enfant',
                    (function* () {
                        log.push('enfant');
                    })()
                );
                log.push('parent');
            })()
        );
        s.tick();
        expect(log).toEqual(['parent', 'enfant']);
    });

    it('stopAll arrête tout et exécute les blocs finally', () => {
        const s = new Scheduler();
        let cleaned = false;
        let after = false;
        s.spawn(
            'x',
            (function* () {
                try {
                    yield;
                    after = true;
                } finally {
                    cleaned = true;
                }
            })()
        );
        s.tick();
        s.stopAll();
        s.tick();
        expect(cleaned).toBe(true);
        expect(after).toBe(false);
        expect(s.count).toBe(0);
    });

    it('un script peut s’arrêter lui-même', () => {
        const s = new Scheduler();
        let after = false;
        const handle: { thread?: ScriptThread } = {};
        const self = s.spawn(
            'self',
            (function* (): ScriptCoroutine {
                s.kill(handle.thread!);
                yield;
                after = true;
            })()
        );
        handle.thread = self;
        s.tick();
        s.tick();
        expect(after).toBe(false);
        expect(self.done).toBe(true);
    });

    it('arrête un script en boucle infinie sans pause et le signale', () => {
        const s = new Scheduler();
        s.maxStepsPerResume = 1000;
        const onError = vi.fn();
        s.onError = onError;
        const other = vi.fn();
        s.spawn(
            'boucle',
            (function* () {
                for (;;) {
                    s.guard();
                }
            })()
        );
        s.spawn(
            'autre',
            (function* () {
                for (;;) {
                    other();
                    yield;
                }
            })()
        );
        s.tick();
        s.tick();
        expect(onError).toHaveBeenCalledOnce();
        expect(onError.mock.calls[0][1]).toBeInstanceOf(ScriptStepLimitError);
        expect(other).toHaveBeenCalledTimes(2);
        expect(s.count).toBe(1);
    });

    it('une erreur n’arrête que le script fautif', () => {
        const s = new Scheduler();
        const errors: string[] = [];
        s.onError = (t) => errors.push(t.name);
        s.spawn(
            'casse',
            (function* () {
                throw new Error('boum');
            })()
        );
        s.tick();
        expect(errors).toEqual(['casse']);
    });
});

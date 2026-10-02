import { describe, expect, it } from 'vitest';
import { FairyAnimation, LoopType } from '@fairy/FairyAnimation';

describe('FairyAnimation', () => {
    it('avance d’une frame toutes les `dur` ticks et boucle en mode Forward', () => {
        const anim = new FairyAnimation();
        anim.setFrameRange(0, 3);
        anim.setLoop(LoopType.Forward, 1, 2, 0);
        const frames: number[] = [];
        for (let i = 0; i < 8; i++) {
            anim.proceed();
            frames.push(anim.nFrameIndex);
        }
        expect(frames).toEqual([0, 1, 1, 2, 2, 0, 0, 1]);
        expect(anim.bOver).toBe(false);
    });

    it('passe à bOver après le nombre de boucles demandé', () => {
        const anim = new FairyAnimation();
        anim.setFrameRange(0, 2);
        anim.setLoop(LoopType.Forward, 1, 1, 1);
        anim.proceed();
        expect(anim.bOver).toBe(false);
        anim.proceed();
        expect(anim.bOver).toBe(true);
        expect(anim.nFrameIndex).toBe(1);
    });
});

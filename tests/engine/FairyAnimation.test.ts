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

    it('joue les frames à l’envers en mode Backward, en commençant par la dernière', () => {
        const anim = new FairyAnimation();
        anim.setFrameRange(0, 3);
        anim.setLoop(LoopType.Backward, 1, 1, 0);
        const frames = [anim.nFrameIndex];
        for (let i = 0; i < 6; i++) {
            anim.proceed();
            frames.push(anim.nFrameIndex);
        }
        expect(frames).toEqual([2, 1, 0, 2, 1, 0, 2]);
    });

    it('termine une passe complète en mode Backward avant bOver, figé sur la frame 0', () => {
        const anim = new FairyAnimation();
        anim.setFrameRange(0, 3);
        anim.setLoop(LoopType.Backward, 1, 1, 1);
        anim.proceed();
        anim.proceed();
        expect(anim.bOver).toBe(false);
        expect(anim.nFrameIndex).toBe(0);
        anim.proceed();
        expect(anim.bOver).toBe(true);
        expect(anim.nFrameIndex).toBe(0);
    });
});

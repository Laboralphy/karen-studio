import { describe, expect, it } from 'vitest';
import { FairyTicker } from '@fairy/FairyTicker';

/** Simulate `seconds` of animation frames at `hz` and count the ticks. */
function countTicks(ticker: FairyTicker, seconds: number, hz: number): number {
    let total = 0;
    const frames = Math.round(seconds * hz);
    for (let i = 0; i <= frames; i++) {
        total += ticker.advance((i * 1000) / hz);
    }
    return total;
}

describe('FairyTicker', () => {
    it('donne 30 ticks par seconde à 30 fps, quel que soit l’écran', () => {
        expect(countTicks(new FairyTicker(30), 1, 60)).toBe(30);
        expect(countTicks(new FairyTicker(30), 1, 144)).toBe(30);
    });

    it('donne 20 ticks par seconde à 20 fps', () => {
        expect(countTicks(new FairyTicker(20), 1, 60)).toBe(20);
    });

    it('limite le rattrapage après une pause et abandonne le retard', () => {
        const t = new FairyTicker(30);
        t.advance(0);
        expect(t.advance(10_000)).toBe(5);
        expect(t.advance(10_010)).toBe(0);
    });

    it('le premier appel démarre seulement l’horloge', () => {
        const t = new FairyTicker(30);
        expect(t.advance(5000)).toBe(0);
        t.reset();
        expect(t.advance(9000)).toBe(0);
    });

    it('refuse une cadence invalide', () => {
        expect(() => new FairyTicker(0)).toThrow();
    });
});

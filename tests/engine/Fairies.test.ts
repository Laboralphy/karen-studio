import { describe, expect, it } from 'vitest';
import { Fairies } from '@fairy/Fairies';
import { Fairy } from '@fairy/Fairy';

/** Layer holding `n` fresh fairies; returns both. */
function layerWith(n: number): [Fairies, Fairy[]] {
    const layer = new Fairies();
    const fairies = Array.from({ length: n }, () => new Fairy());
    fairies.forEach((f) => layer.linkFairy(f));
    return [layer, fairies];
}

/** Indices (in `fairies`) of the layer's live sprites, in rendering order. */
function order(layer: Fairies, fairies: Fairy[]): number[] {
    return layer.getFairies().map((f) => fairies.indexOf(f));
}

describe('Fairies', () => {
    it('préserve l’ordre d’affichage quand un sprite meurt', () => {
        const [layer, fairies] = layerWith(4);
        fairies[1].bDead = true;
        layer.proceed();
        expect(order(layer, fairies)).toEqual([0, 2, 3]);
    });

    it('retire plusieurs sprites morts en gardant l’ordre des survivants', () => {
        const [layer, fairies] = layerWith(6);
        fairies[0].bDead = true;
        fairies[3].bDead = true;
        fairies[5].bDead = true;
        layer.proceed();
        expect(order(layer, fairies)).toEqual([1, 2, 4]);
    });
});

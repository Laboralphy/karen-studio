import { describe, expect, it } from 'vitest';
import { FairyInputState } from '@fairy/FairyInputState';

const UP = 38;

describe('FairyInputState', () => {
    it('signale « pressée » pendant un seul tick', () => {
        const input = new FairyInputState();
        input.setKeyState(UP, true);
        expect(input.isKeyPressed(UP)).toBe(true);
        expect(input.getKeyState(UP)).toBe(true);
        input.endTick();
        expect(input.isKeyPressed(UP)).toBe(false);
        expect(input.getKeyState(UP)).toBe(true);
    });

    it('ignore la répétition automatique du clavier', () => {
        const input = new FairyInputState();
        input.setKeyState(UP, true);
        input.endTick();
        input.setKeyState(UP, true);
        expect(input.isKeyPressed(UP)).toBe(false);
    });

    it('ne rate pas un appui plus court qu’un tick', () => {
        const input = new FairyInputState();
        input.setKeyState(UP, true);
        input.setKeyState(UP, false);
        expect(input.isKeyPressed(UP)).toBe(true);
        expect(input.isKeyReleased(UP)).toBe(true);
        expect(input.getKeyState(UP)).toBe(false);
    });

    it('relâche toutes les touches (perte de focus)', () => {
        const input = new FairyInputState();
        input.setKeyState(UP, true);
        input.endTick();
        input.releaseAll();
        expect(input.getKeyState(UP)).toBe(false);
        expect(input.isKeyReleased(UP)).toBe(true);
    });
});

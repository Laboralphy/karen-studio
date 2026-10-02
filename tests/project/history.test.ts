import { describe, expect, it } from 'vitest';
import { UndoHistory } from '@project/history';

describe('historique annuler / rétablir', () => {
    it('annule puis rétablit dans l’ordre', () => {
        const h = new UndoHistory();
        h.reset('a');
        h.record('b');
        h.record('c');
        expect(h.undo()).toBe('b');
        expect(h.undo()).toBe('a');
        expect(h.undo()).toBeNull();
        expect(h.redo()).toBe('b');
        expect(h.redo()).toBe('c');
        expect(h.redo()).toBeNull();
    });

    it('n’enregistre pas un état identique', () => {
        const h = new UndoHistory();
        h.reset('a');
        expect(h.record('a')).toBe(false);
        expect(h.canUndo).toBe(false);
    });

    it('une nouvelle modification après une annulation efface la branche « rétablir »', () => {
        const h = new UndoHistory();
        h.reset('a');
        h.record('b');
        h.undo();
        h.record('x');
        expect(h.canRedo).toBe(false);
        expect(h.undo()).toBe('a');
    });

    it('oublie les états les plus anciens au-delà de la limite', () => {
        const h = new UndoHistory(2);
        h.reset('0');
        for (const s of ['1', '2', '3']) h.record(s);
        expect(h.undo()).toBe('2');
        expect(h.undo()).toBe('1');
        expect(h.undo()).toBeNull();
    });
});

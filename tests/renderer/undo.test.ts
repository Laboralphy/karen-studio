import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    commitHistory,
    createNewProject,
    redo,
    store,
    touch,
    undo,
} from '../../src/renderer/src/store/project';

describe('annuler / rétablir dans l’éditeur', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        store.dirty = false;
        createNewProject(); // fresh project and history
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('regroupe les modifications rapprochées en une seule étape', () => {
        const bob = store.project.bobs[0];
        bob.name = 'H';
        touch();
        vi.advanceTimersByTime(100);
        bob.name = 'Ho';
        touch();
        vi.advanceTimersByTime(100);
        bob.name = 'Hop';
        touch();
        vi.advanceTimersByTime(1000);
        expect(undo()).toBe(true);
        expect(store.project.bobs[0].name).toBe('Herbe');
        expect(redo()).toBe(true);
        expect(store.project.bobs[0].name).toBe('Hop');
    });

    it('annule même une modification toute récente (pas encore regroupée)', () => {
        store.project.levels[0].tiles[0] = 3;
        touch();
        expect(store.canUndo).toBe(true);
        undo();
        expect(store.project.levels[0].tiles[0]).toBe(0);
    });

    it('ne touche jamais au code des blocs', () => {
        store.project.name = 'Autre';
        touch();
        commitHistory();
        store.project.code = { blocs: 'modifiés' };
        undo();
        expect(store.project.name).toBe('Mon jeu');
        expect(store.project.code).toEqual({ blocs: 'modifiés' });
    });

    it('un nouveau projet repart d’un historique vide', () => {
        store.project.name = 'Autre';
        touch();
        commitHistory();
        store.dirty = false;
        createNewProject();
        expect(store.canUndo).toBe(false);
        expect(undo()).toBe(false);
    });
});

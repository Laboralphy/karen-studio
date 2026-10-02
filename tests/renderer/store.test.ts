import { describe, expect, it } from 'vitest';
import { placeMarker } from '@project/level';
import { projectSnapshot, store } from '../../src/renderer/src/store/project';

describe('copie du projet pour lancer le jeu', () => {
    it('fonctionne après des modifications qui laissent des objets réactifs dans le projet', () => {
        // Same operations as the editors, through the reactive store.
        const level = store.project.levels[0];
        placeMarker(level, 1, 1, 'a');
        placeMarker(level, 2, 2, 'b');
        level.markers = level.markers.filter((m) => m.tag !== 'a');
        const sprite = store.project.sprites[0];
        sprite.frames = [...sprite.frames].reverse();

        const snapshot = projectSnapshot();
        expect(snapshot.levels[0].markers).toEqual([expect.objectContaining({ tag: 'b' })]);
        expect(snapshot.sprites[0].frames).toHaveLength(3);
        // A real deep copy: changing it does not touch the edited project.
        snapshot.levels[0].markers.length = 0;
        expect(store.project.levels[0].markers).toHaveLength(1);
        // And it can be cloned like any plain data (what the game runtime does).
        expect(() => structuredClone(snapshot)).not.toThrow();
    });
});

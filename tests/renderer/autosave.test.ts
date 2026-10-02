import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newProject } from '@project/defaults';
import { saveProject } from '@project/serialize';
import {
    autosave,
    createNewProject,
    offerAutosaveRestore,
    store,
    touch,
} from '../../src/renderer/src/store/project';

/** In-memory stand-in for the main process autosave files. */
function fakeApi(saved: { content: string; path: string | null } | null = null) {
    let copy = saved && { ...saved, date: '2026-10-02T10:00:00.000Z' };
    const api = {
        autosaveWrite: vi.fn(async (content: string, path: string | null) => {
            copy = { content, path, date: new Date().toISOString() };
        }),
        autosaveRead: vi.fn(async () => copy),
        autosaveClear: vi.fn(async () => {
            copy = null;
        }),
        get copy() {
            return copy;
        },
    };
    vi.stubGlobal('karen', api);
    return api;
}

describe('sauvegarde automatique', () => {
    beforeEach(() => {
        fakeApi();
        store.dirty = false;
        createNewProject();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('n’écrit la copie de secours que s’il y a des modifications', async () => {
        const api = fakeApi();
        await autosave();
        expect(api.autosaveWrite).not.toHaveBeenCalled();
        store.project.name = 'Mon platformer';
        touch();
        await autosave();
        expect(api.autosaveWrite).toHaveBeenCalledOnce();
        expect(JSON.parse(api.copy!.content).name).toBe('Mon platformer');
    });

    it('propose de restaurer la copie trouvée au démarrage', async () => {
        const saved = { ...newProject(), name: 'Rescapé' };
        const api = fakeApi({ content: saveProject(saved), path: '/jeux/rescape.karen' });
        const confirm = vi.fn((_message: string) => true);
        vi.stubGlobal('confirm', confirm);

        expect(await offerAutosaveRestore()).toBe(true);
        expect(confirm.mock.calls[0][0]).toMatch(/rescape\.karen/);
        expect(store.project.name).toBe('Rescapé');
        expect(store.filePath).toBe('/jeux/rescape.karen');
        expect(store.dirty).toBe(true); // still to be saved in its file
        expect(api.autosaveClear).not.toHaveBeenCalled();
    });

    it('efface la copie si on refuse de la restaurer', async () => {
        const api = fakeApi({ content: saveProject(newProject()), path: null });
        vi.stubGlobal('confirm', () => false);
        expect(await offerAutosaveRestore()).toBe(false);
        expect(api.copy).toBeNull();
    });

    it('ignore (et efface) une copie illisible', async () => {
        const api = fakeApi({ content: 'abîmé', path: null });
        vi.stubGlobal('confirm', () => true);
        const alert = vi.fn();
        vi.stubGlobal('alert', alert);
        expect(await offerAutosaveRestore()).toBe(false);
        expect(alert).toHaveBeenCalledOnce();
        expect(api.copy).toBeNull();
    });

    it('ne propose rien quand il n’y a pas de copie', async () => {
        const confirm = vi.fn();
        vi.stubGlobal('confirm', confirm);
        expect(await offerAutosaveRestore()).toBe(false);
        expect(confirm).not.toHaveBeenCalled();
    });
});

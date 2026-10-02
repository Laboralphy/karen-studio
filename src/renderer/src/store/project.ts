import { reactive, toRaw } from 'vue';
import { newProject } from '@project/defaults';
import { loadProject, saveProject } from '@project/serialize';
import type { KarenProject } from '@project/model';
import { UndoHistory } from '@project/history';

/** The project being edited, shared by every tab. */
export const store = reactive({
    project: newProject(),
    /** File the project was opened from / saved to, or null for a new project. */
    filePath: null as string | null,
    /** True when there are unsaved changes. */
    dirty: false,
    /** Incremented each time the whole project is replaced (new / open). */
    generation: 0,
    canUndo: false,
    canRedo: false,
});

// ── Undo / redo ──────────────────────────────────────────────────────────────
// Every edit calls `touch()`; edits close together (a brush stroke, a word typed) are
// grouped into one undo step. The Blockly code is left out: the Code tab has its own
// undo (Ctrl+Z in the workspace), and undoing other edits never changes the blocks.

/** Delay grouping consecutive edits into one undo step. */
const GROUP_MS = 400;
const history = new UndoHistory(100);
let pendingCommit: ReturnType<typeof setTimeout> | null = null;

/** The undoable part of the project, serialised. */
function editState(): string {
    return JSON.stringify({ ...store.project, code: null });
}

function syncFlags(): void {
    store.canUndo = history.canUndo;
    store.canRedo = history.canRedo;
}

/** Record the pending edits as one undo step now. */
export function commitHistory(): void {
    if (pendingCommit !== null) {
        clearTimeout(pendingCommit);
        pendingCommit = null;
    }
    history.record(editState());
    syncFlags();
}

/** Mark the project as modified. Call after every edit. */
export function touch(): void {
    store.dirty = true;
    if (pendingCommit !== null) {
        clearTimeout(pendingCommit);
    }
    pendingCommit = setTimeout(commitHistory, GROUP_MS);
    store.canUndo = true;
}

/** Put back a recorded state (keeping the current blocks). */
function restore(state: string): void {
    const project = JSON.parse(state) as KarenProject;
    project.code = store.project.code;
    store.project = project;
    store.dirty = true;
    syncFlags();
}

/** Undo the last edit (outside the blocks). Returns false if there was nothing to undo. */
export function undo(): boolean {
    commitHistory();
    const state = history.undo();
    if (state === null) return false;
    restore(state);
    return true;
}

/** Redo the last undone edit. Returns false if there was nothing to redo. */
export function redo(): boolean {
    commitHistory();
    const state = history.redo();
    if (state === null) return false;
    restore(state);
    return true;
}

history.reset(editState());

/**
 * A plain deep copy of project data (or part of it).
 * Not `structuredClone`: edits can leave Vue proxies nested inside the raw data (e.g. an
 * array built with `filter` on a reactive array), which it refuses to copy. The project
 * only holds JSON data, so a JSON round trip is exact and sees through proxies.
 */
export function plainCopy<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

/** A plain (non-reactive) deep copy of the current project, e.g. to run it. */
export function projectSnapshot(): KarenProject {
    return plainCopy(store.project);
}

function replace(project: KarenProject, filePath: string | null): void {
    store.project = project;
    store.filePath = filePath;
    store.dirty = false;
    store.generation++;
    if (pendingCommit !== null) {
        clearTimeout(pendingCommit);
        pendingCommit = null;
    }
    history.reset(editState());
    syncFlags();
}

/** Ask before losing unsaved changes. Returns true when it is OK to continue. */
export function confirmDiscard(): boolean {
    return (
        !store.dirty ||
        window.confirm('Le projet a des modifications non enregistrées. Les abandonner ?')
    );
}

/** Start a new project (with starter content). */
export function createNewProject(): void {
    if (confirmDiscard()) {
        replace(newProject(), null);
        void window.karen?.autosaveClear();
    }
}

/** Open a project file. Throws `ProjectFileError` when the file is invalid. */
export async function openProjectFile(): Promise<boolean> {
    if (!confirmDiscard()) {
        return false;
    }
    const file = await window.karen.openProject();
    if (!file) {
        return false;
    }
    replace(loadProject(file.content), file.path);
    void window.karen.autosaveClear();
    return true;
}

/** Save the project; with `saveAs` (or a new project), ask where. Returns false if cancelled. */
export async function saveProjectFile(saveAs = false): Promise<boolean> {
    const content = saveProject(toRaw(store.project));
    const result = await window.karen.saveProject(
        content,
        saveAs ? null : store.filePath,
        store.project.name
    );
    if (!result) {
        return false;
    }
    store.filePath = result.path;
    store.dirty = false;
    void window.karen.autosaveClear();
    return true;
}

// ── Safety copy (crash recovery) ─────────────────────────────────────────────

/** How often unsaved changes are copied, in milliseconds. */
export const AUTOSAVE_MS = 60_000;

/** Write the safety copy if there are unsaved changes. */
export async function autosave(): Promise<void> {
    if (store.dirty) {
        await window.karen.autosaveWrite(saveProject(toRaw(store.project)), store.filePath);
    }
}

/**
 * At start-up: if a safety copy exists (the app did not close normally), offer to restore
 * it. Returns true if it was restored.
 */
export async function offerAutosaveRestore(): Promise<boolean> {
    const saved = await window.karen.autosaveRead();
    if (!saved) return false;
    const when = new Date(saved.date).toLocaleString('fr-FR');
    const where = saved.path ? ` (fichier « ${saved.path.split(/[\\/]/).pop()} »)` : '';
    const restore = window.confirm(
        `Karen Studio ne s'est pas fermé normalement. Une copie de secours du projet${where} ` +
            `datant du ${when} a été trouvée.\n\nLa restaurer ?`
    );
    if (restore) {
        try {
            replace(loadProject(saved.content), saved.path);
            store.dirty = true; // not saved in its file yet
            return true;
        } catch {
            window.alert('La copie de secours est illisible : elle est ignorée.');
        }
    }
    await window.karen.autosaveClear();
    return false;
}

import { reactive, toRaw } from 'vue';
import { newProject } from '@project/defaults';
import { loadProject, saveProject } from '@project/serialize';
import type { KarenProject } from '@project/model';

/** The project being edited, shared by every tab. */
export const store = reactive({
    project: newProject(),
    /** File the project was opened from / saved to, or null for a new project. */
    filePath: null as string | null,
    /** True when there are unsaved changes. */
    dirty: false,
    /** Incremented each time the whole project is replaced (new / open). */
    generation: 0,
});

/** Mark the project as modified. Call after every edit. */
export function touch(): void {
    store.dirty = true;
}

/** A plain (non-reactive) deep copy of the current project, e.g. to run it. */
export function projectSnapshot(): KarenProject {
    return structuredClone(toRaw(store.project));
}

function replace(project: KarenProject, filePath: string | null): void {
    store.project = project;
    store.filePath = filePath;
    store.dirty = false;
    store.generation++;
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
    return true;
}

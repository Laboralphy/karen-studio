/** API exposée au renderer via `window.karen` (voir src/preload/index.ts). */
export interface KarenApi {
    /** Version de l'application (package.json). */
    getVersion(): Promise<string>;
    /** Demande un fichier projet à ouvrir ; null si annulé. */
    openProject(): Promise<{ path: string; content: string } | null>;
    /**
     * Enregistre `content`. Sans `path`, demande où enregistrer (nom proposé : `suggestedName`).
     * Renvoie le chemin utilisé, ou null si annulé.
     */
    saveProject(
        content: string,
        path: string | null,
        suggestedName: string
    ): Promise<{ path: string; name: string } | null>;
    /** Écrit la copie de secours du projet (avec le fichier d'origine, s'il y en a un). */
    autosaveWrite(content: string, path: string | null): Promise<void>;
    /** Lit la copie de secours, ou null s'il n'y en a pas. `date` : ISO 8601. */
    autosaveRead(): Promise<{ content: string; path: string | null; date: string } | null>;
    /** Efface la copie de secours. */
    autosaveClear(): Promise<void>;
}

declare global {
    interface Window {
        karen: KarenApi;
    }
}

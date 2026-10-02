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
}

declare global {
    interface Window {
        karen: KarenApi;
    }
}

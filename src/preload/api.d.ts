/** API exposée au renderer via `window.karen` (voir src/preload/index.ts). */
export interface KarenApi {
    /** Version de l'application (package.json). */
    getVersion(): Promise<string>;
}

declare global {
    interface Window {
        karen: KarenApi;
    }
}

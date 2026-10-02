import { contextBridge, ipcRenderer } from 'electron';
import type { KarenApi } from './api';

const api: KarenApi = {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    openProject: () => ipcRenderer.invoke('project:open'),
    saveProject: (content, path, suggestedName) =>
        ipcRenderer.invoke('project:save', content, path, suggestedName),
};

contextBridge.exposeInMainWorld('karen', api);

import { contextBridge, ipcRenderer } from 'electron';
import type { KarenApi } from './api';

const api: KarenApi = {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
};

contextBridge.exposeInMainWorld('karen', api);

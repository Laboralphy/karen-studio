import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';

/** Filter for project files in open/save dialogs. */
const PROJECT_FILTERS = [{ name: 'Projet Karen Studio', extensions: ['karen'] }];

function createWindow(): void {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1100,
        minHeight: 700,
        title: 'Karen Studio',
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            // The game plays sounds without waiting for a click in the page.
            autoplayPolicy: 'no-user-gesture-required',
        },
    });

    // Modifications non enregistrées : le renderer bloque la fermeture (beforeunload),
    // on demande alors confirmation.
    win.webContents.on('will-prevent-unload', (event) => {
        const choice = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['Quitter sans enregistrer', 'Annuler'],
            defaultId: 1,
            cancelId: 1,
            title: 'Karen Studio',
            message: 'Le projet a des modifications non enregistrées.',
            detail: 'Si tu quittes maintenant, elles seront perdues.',
        });
        if (choice === 0) {
            event.preventDefault();
        }
    });

    // Les liens externes s'ouvrent dans le navigateur, jamais dans l'application.
    win.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: 'deny' };
    });

    if (process.env['ELECTRON_RENDERER_URL']) {
        void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        void win.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('project:open', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)!;
    const result = await dialog.showOpenDialog(win, {
        title: 'Ouvrir un projet',
        filters: PROJECT_FILTERS,
        properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    const path = result.filePaths[0];
    return { path, content: await readFile(path, 'utf8') };
});

ipcMain.handle(
    'project:save',
    async (event, content: string, path: string | null, suggestedName: string) => {
        let target = path;
        if (!target) {
            const win = BrowserWindow.fromWebContents(event.sender)!;
            const result = await dialog.showSaveDialog(win, {
                title: 'Enregistrer le projet',
                defaultPath: `${suggestedName}.karen`,
                filters: PROJECT_FILTERS,
            });
            if (result.canceled || !result.filePath) {
                return null;
            }
            target = result.filePath.endsWith('.karen')
                ? result.filePath
                : `${result.filePath}.karen`;
        }
        await writeFile(target, content, 'utf8');
        return { path: target, name: basename(target) };
    }
);

void app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

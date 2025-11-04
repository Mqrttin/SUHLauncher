/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { app, ipcMain, nativeTheme, Tray, Menu } = require('electron');
const { Microsoft } = require('minecraft-java-core');
const { autoUpdater } = require('electron-updater');

const path = require('path');
const fs = require('fs');

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

let tray = null; // Variable global para tray

const rpc = require('discord-rich-presence')('1430756350371168307');

// --- Librería para consultar servidor Minecraft ---
const { queryFull } = require('minecraft-server-util');

// ---------------- Función para salir del launcher ----------------
function quitLauncher() {
    if (rpc) rpc.disconnect();

    const mainWin = MainWindow.getWindow();
    if (mainWin && !mainWin.isDestroyed()) {
        try { mainWin.destroy(); } catch (e) {}
    }

    const updateWin = UpdateWindow.getWindow();
    if (updateWin && !updateWin.isDestroyed()) {
        try { updateWin.destroy(); } catch (e) {}
    }

    // Destruye el tray si existe
    if (tray && !tray.isDestroyed()) {
        try { tray.destroy(); } catch (e) {}
    }

    app.exit(0);
}

// ---------------- Función actualizada: Actualizar RPC con jugadores ----------------
const { status } = require('minecraft-server-util');

function actualizarJugadoresRPC() {
    status('172.96.172.240', 25530) // usa el puerto de conexión normal del servidor
        .then((response) => {
            console.log('Estado del servidor:', response);

            const jugadoresConectados = response.players?.online ?? 0;
            const maxJugadores = response.players?.max ?? 0;

            rpc.updatePresence({
                state: `Jugadores: ${jugadoresConectados}/${maxJugadores}`,
                details: 'Jugando Soul Ultra Hardcore',
                startTimestamp: Date.now(),
                largeImageKey: 'logo',
                largeImageText: 'SoulUltraHardcore',
                instance: true,
            });
        })
        .catch((err) => {
            console.error('Error al consultar servidor:', err);
            rpc.updatePresence({
                state: 'Servidor offline',
                details: 'Intenta más tarde',
                startTimestamp: Date.now(),
                largeImageKey: 'logo',
                largeImageText: 'SoulUltraHardcore',
                instance: true,
            });
        });
}

// ---------------- RPC Inicial ----------------
rpc.updatePresence({
    state: 'Jugando',
    details: '¿Estás listo?',
    startTimestamp: Date.now(),
    largeImageKey: 'logo',
    largeImageText: 'SoulUltraHardcore',
    instance: true,
});

console.log("Discord Rich Presence activado.");

// ---------------- Ejecutar actualización de jugadores cada 15s ----------------
setInterval(actualizarJugadoresRPC, 15000);
actualizarJugadoresRPC(); // Llamada inicial

// ---------------- Resto de tu código original ----------------
let dev = process.env.NODE_ENV === 'dev';

if (dev) {
    let appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
    let appdata = path.resolve('./data').replace(/\\/g, '/');
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
    if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
    app.setPath('userData', appPath);
    app.setPath('appData', appdata)
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
    if (dev) {
        MainWindow.createWindow();
    } else {
        UpdateWindow.createWindow();
    }

    // ---------------- Tray antiguo ----------------
    tray = new Tray(path.join(__dirname, 'assets', 'images', 'icon.png'));

    tray.setToolTip('Soul Ultra Hardcore Launcher'); // <-- NUEVA LÍNEA
    
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Abrir Launcher',
            click: () => {
                let win = MainWindow.getWindow();
                if (win) {
                    win.show();
                    win.focus();
                } else {
                    MainWindow.createWindow();
                }
            }
        },
        { 
            label: 'Cerrar',
            click: () => quitLauncher()
        }
    ]);
    tray.setContextMenu(contextMenu);


    let win = MainWindow.getWindow();
    if (win) {
        win.on('close', (event) => {
            event.preventDefault();
            quitLauncher();
        });
    }
});

ipcMain.on('main-window-open', () => MainWindow.createWindow());
ipcMain.on('main-window-dev-tools', () => MainWindow.getWindow().webContents.openDevTools({ mode: 'detach' }));
ipcMain.on('main-window-dev-tools-close', () => MainWindow.getWindow().webContents.closeDevTools());
ipcMain.on('main-window-close', () => MainWindow.destroyWindow());
ipcMain.on('main-window-reload', () => MainWindow.getWindow().reload());
ipcMain.on('main-window-progress', (event, options) => MainWindow.getWindow().setProgressBar(options.progress / options.size));
ipcMain.on('main-window-progress-reset', () => MainWindow.getWindow().setProgressBar(-1));
ipcMain.on('main-window-progress-load', () => MainWindow.getWindow().setProgressBar(2));
ipcMain.on('main-window-minimize', () => MainWindow.getWindow().minimize());

ipcMain.on('update-window-close', () => UpdateWindow.destroyWindow());
ipcMain.on('update-window-dev-tools', () => UpdateWindow.getWindow().webContents.openDevTools({ mode: 'detach' }));
ipcMain.on('update-window-progress', (event, options) => UpdateWindow.getWindow().setProgressBar(options.progress / options.size));
ipcMain.on('update-window-progress-reset', () => UpdateWindow.getWindow().setProgressBar(-1));
ipcMain.on('update-window-progress-load', () => UpdateWindow.getWindow().setProgressBar(2));

ipcMain.handle('path-user-data', () => app.getPath('userData'));
ipcMain.handle('appData', e => app.getPath('appData'));

ipcMain.on('main-window-maximize', () => {
    if (MainWindow.getWindow().isMaximized()) {
        MainWindow.getWindow().unmaximize();
    } else {
        MainWindow.getWindow().maximize();
    }
});

ipcMain.on('main-window-hide', () => MainWindow.getWindow().hide());
ipcMain.on('main-window-show', () => MainWindow.getWindow().show());

ipcMain.on('minecraft-launch', () => {
    const win = MainWindow.getWindow();
    if (win) win.webContents.send('pause-audio');
});

ipcMain.on('minecraft-close', () => {
    const win = MainWindow.getWindow();
    if (win) win.webContents.send('resume-audio');
});

ipcMain.handle('Microsoft-window', async (_, client_id) => {
    return await new Microsoft(client_id).getAuth();
});

ipcMain.handle('is-dark-theme', (_, theme) => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return nativeTheme.shouldUseDarkColors;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') return;
});

autoUpdater.autoDownload = false;

ipcMain.handle('update-app', async () => {
    return await new Promise(async (resolve, reject) => {
        autoUpdater.checkForUpdates().then(res => {
            resolve(res);
        }).catch(error => {
            reject({
                error: true,
                message: error
            });
        });
    });
});

autoUpdater.on('update-available', () => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('updateAvailable');
});

ipcMain.on('start-update', () => {
    autoUpdater.downloadUpdate();
});

autoUpdater.on('update-not-available', () => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('update-not-available');
});

autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall();
});

autoUpdater.on('download-progress', (progress) => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('download-progress', progress);
});

autoUpdater.on('error', (err) => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('error', err);
});

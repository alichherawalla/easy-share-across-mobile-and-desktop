import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog } from 'electron';
import { join } from 'path';
import * as os from 'os';
import { DiscoveryService } from './discovery';
import { ConnectionManager } from './connection';
import { StorageService } from './storage';
import type { DeviceInfo, PairedDevice, Transfer } from '@easyshare/shared';

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let discoveryService: DiscoveryService | null = null;
let connectionManager: ConnectionManager | null = null;
let storageService: StorageService | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 600,
    minHeight: 500,
    show: false,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAhGVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABAAAAAEAAABaAAAAAAAAAEgAAAABAAAASAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAIKADAAQAAAABAAAAIAAAAABfvA/wAAAACXBIWXMAAAsTAAALEwEAmpwYAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoZXuEHAAADGElEQVRYCe1XS0hUURj+z713xsdoM2qYFkqYEFELg1q0KIoW0aZFtCgIahMtWrSIVtGmTbRo1yqiRRRBi1pE9IAgomhRRBRBUWE+Gs3X3Lndc/6/O+PMODMOzSII/OHOuef8j+/8/zn/OQr/+Kf+cXxGwe+1RFEUhXzeoB4MqhCtLxCJRhVFVTXLslQvK4rw8YFuWPZPuG3Q2C+AdIDhiJ5YLBbTbNvWTNM0LVMPm6YZZ1qWFeP0MVKmfmLaBssSpqWFDcPQPqNBX6Pp+RDNVw+m+mHpJuAJWXrCcQJmD8syTdsyDNN0O3C5C5BkW0IOiwO6XRYu1+mCXuZlW6prW0BfKBL2U9U4eBNYtum4ADaQYVrCtoUFGUVJwNz0u7bhUFThENM2LJP0YZoWtCfwLZNuAJJJYvLacFzA6UQn6VJjnpYnECCLbmKhruPaQNwdw7ANy3ScgLmB+HQS4AGwLHFdAMtuFwCPbqCO7wTENrUJ2CTxw0G3YACx/i0MG+A+1wdswAR4nYDXJniP4ufkJEWncB0HCMQJeF0AOIq54HYBdyC/MdIG0p8YTgCfwZZt6wYdgJmXRjJtIB5PDhBIBggc+g9JJIVhxOkCCdexAhBskE6gCWiA1GfLOiHwOIG4BHB4CcVxApKDMJK0QY4lQ4ahuAMwcxFIBpjHCZhIEhAAjvYwHoWV2x4HwAV+J0jAORhh2wbFgB1QDwIPIgNvOxnA5gAP4YDPBey4AzAJsCUBLhAI0A5Isk0FaIPhJB6J+OsEmLYJB+CKbRP8PoR0Qj5dACTHk0YSZB4H4Jy6gD83I/EYZRzASwu46nEAhBuQI3CC9E7AdAJWXCcwkoETGEyqAEWJmAjQHLBwAj8S+BsnAA7PDdK/2yCdQM9BPIQ2aCdwJw3E/QkZhZ7g4BuQPgF3DgCPhk0FmMvkA2GugPfECYw9BZT9dZcHgS+B5QTJyQOAtwCPwAaUvBNQqXICBOj3Q7AA8ngNsHGCVJ3ApUwCPQIa4H+0gKAPpD8xTBV4dILEHIALlpF8jfQTKn8BG/+8Ytr3A0EAAAAASUVORK5CYII='
  );

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open EasyShare',
      click: () => {
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('EasyShare');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

async function initializeServices(): Promise<void> {
  storageService = new StorageService();
  await storageService.initialize();

  const settings = storageService.getSettings();

  discoveryService = new DiscoveryService({
    id: settings.deviceId,
    name: settings.deviceName,
    platform: 'macos',
    version: '1.0.0',
    host: '',
    port: 0,
  });

  const localIp = getLocalIp();
  connectionManager = new ConnectionManager(storageService, localIp);

  // Helper to safely send to renderer
  const safeSend = (channel: string, data: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  // Set up discovery callbacks
  discoveryService.onDeviceFound((device) => {
    safeSend('device:found', device);
  });

  discoveryService.onDeviceLost((deviceId) => {
    safeSend('device:lost', deviceId);
  });

  // Set up connection callbacks
  connectionManager.onConnectionStateChange((state) => {
    safeSend('connection:state', state);
  });

  connectionManager.onTransferProgress((progress) => {
    safeSend('transfer:progress', progress);
  });

  connectionManager.onTransferComplete((transfer) => {
    storageService?.addTransfer(transfer);
    safeSend('transfer:complete', transfer);
  });

  connectionManager.onTextReceived((text, device) => {
    safeSend('text:received', { text, device });
  });

  connectionManager.onPairingRequest((device) => {
    safeSend('pairing:request', device);
  });

  // Start services
  await discoveryService.start();
  await connectionManager.start();
  await discoveryService.advertise(connectionManager.getServerInfo());
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Get app state
  ipcMain.handle('app:getState', () => {
    return {
      settings: storageService?.getSettings(),
      pairedDevices: storageService?.getPairedDevices() || [],
      transfers: storageService?.getTransfers() || [],
    };
  });

  // Update settings
  ipcMain.handle('settings:update', (_event, settings) => {
    storageService?.updateSettings(settings);
    return storageService?.getSettings();
  });

  // Connect to device
  ipcMain.handle('device:connect', async (_event, device: DeviceInfo) => {
    return connectionManager?.connectToDevice(device);
  });

  // Disconnect
  ipcMain.handle('device:disconnect', async () => {
    connectionManager?.disconnect();
  });

  // Start pairing
  ipcMain.handle('pairing:start', async (_event, deviceId: string, passphrase: string) => {
    return connectionManager?.startPairing(deviceId, passphrase);
  });

  // Respond to incoming pairing request
  ipcMain.handle('pairing:respond', async (_event, passphrase: string) => {
    connectionManager?.respondToPairing(passphrase);
  });

  // Send text
  ipcMain.handle('transfer:sendText', async (_event, text: string) => {
    return connectionManager?.sendText(text);
  });

  // Send file
  ipcMain.handle('transfer:sendFile', async (_event, filePath: string) => {
    return connectionManager?.sendFile(filePath);
  });

  // Select file dialog (single file)
  ipcMain.handle('dialog:selectFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      title: 'Select a file to send',
    });
    // Reset keepalive — main process event loop may stall during native dialog
    connectionManager?.resetKeepaliveTimer();
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Select files dialog (multiple files)
  ipcMain.handle('dialog:selectFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      title: 'Select files to send',
    });
    // Reset keepalive — main process event loop may stall during native dialog
    connectionManager?.resetKeepaliveTimer();
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths;
  });

  // Remove paired device
  ipcMain.handle('device:unpair', async (_event, deviceId: string) => {
    storageService?.removePairedDevice(deviceId);
    return storageService?.getPairedDevices();
  });

  // Clear transfer history
  ipcMain.handle('transfers:clear', async () => {
    storageService?.clearTransfers();
    return [];
  });

  // Show file in folder (Finder on macOS, Explorer on Windows)
  ipcMain.handle('file:showInFolder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
}

// App lifecycle
app.whenReady().then(async () => {
  await initializeServices();
  setupIpcHandlers();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit on macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await discoveryService?.stop();
  await connectionManager?.stop();
});

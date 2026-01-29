import { contextBridge, ipcRenderer } from 'electron';
import type {
  DeviceInfo,
  DiscoveredDevice,
  PairedDevice,
  Transfer,
  TransferProgress,
  ConnectionState,
  AppSettings,
} from '@easyshare/shared';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const api = {
  // Get app state
  getState: (): Promise<{
    settings: AppSettings;
    pairedDevices: PairedDevice[];
    transfers: Transfer[];
  }> => ipcRenderer.invoke('app:getState'),

  // Settings
  updateSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', settings),

  // Device operations
  connectToDevice: (device: DeviceInfo): Promise<boolean> =>
    ipcRenderer.invoke('device:connect', device),

  disconnectDevice: (): Promise<void> => ipcRenderer.invoke('device:disconnect'),

  unpairDevice: (deviceId: string): Promise<PairedDevice[]> =>
    ipcRenderer.invoke('device:unpair', deviceId),

  // Pairing
  startPairing: (deviceId: string, passphrase: string): Promise<boolean> =>
    ipcRenderer.invoke('pairing:start', deviceId, passphrase),

  respondToPairing: (passphrase: string): Promise<void> =>
    ipcRenderer.invoke('pairing:respond', passphrase),

  // Transfer operations
  sendText: (text: string): Promise<boolean> => ipcRenderer.invoke('transfer:sendText', text),

  sendFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('transfer:sendFile', filePath),

  selectFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFile'),

  clearTransfers: (): Promise<Transfer[]> => ipcRenderer.invoke('transfers:clear'),

  showInFolder: (filePath: string): Promise<void> => ipcRenderer.invoke('file:showInFolder', filePath),

  // Event listeners
  onDeviceFound: (callback: (device: DiscoveredDevice) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, device: DiscoveredDevice) =>
      callback(device);
    ipcRenderer.on('device:found', listener);
    return () => ipcRenderer.removeListener('device:found', listener);
  },

  onDeviceLost: (callback: (deviceId: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, deviceId: string) => callback(deviceId);
    ipcRenderer.on('device:lost', listener);
    return () => ipcRenderer.removeListener('device:lost', listener);
  },

  onConnectionState: (callback: (state: ConnectionState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: ConnectionState) =>
      callback(state);
    ipcRenderer.on('connection:state', listener);
    return () => ipcRenderer.removeListener('connection:state', listener);
  },

  onTransferProgress: (callback: (progress: TransferProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: TransferProgress) =>
      callback(progress);
    ipcRenderer.on('transfer:progress', listener);
    return () => ipcRenderer.removeListener('transfer:progress', listener);
  },

  onTransferComplete: (callback: (transfer: Transfer) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, transfer: Transfer) => callback(transfer);
    ipcRenderer.on('transfer:complete', listener);
    return () => ipcRenderer.removeListener('transfer:complete', listener);
  },

  onTextReceived: (callback: (data: { text: string; device: DeviceInfo }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { text: string; device: DeviceInfo }
    ) => callback(data);
    ipcRenderer.on('text:received', listener);
    return () => ipcRenderer.removeListener('text:received', listener);
  },

  onPairingRequest: (callback: (device: DeviceInfo) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, device: DeviceInfo) => callback(device);
    ipcRenderer.on('pairing:request', listener);
    return () => ipcRenderer.removeListener('pairing:request', listener);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// Type declaration for the renderer
export type ElectronAPI = typeof api;

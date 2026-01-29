import Store from 'electron-store';
import { app } from 'electron';
import { join } from 'path';
import type { AppSettings, PairedDevice, Transfer } from '@easyshare/shared';
import { generateDeviceId } from '@easyshare/shared';
import { hostname } from 'os';

interface StoreSchema {
  settings: AppSettings;
  pairedDevices: PairedDevice[];
  transfers: Transfer[];
}

export class StorageService {
  private store: Store<StoreSchema>;

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'easyshare-data',
      defaults: {
        settings: {
          deviceName: hostname() || 'Mac',
          deviceId: generateDeviceId(),
          autoAcceptFromPaired: true,
          saveDirectory: join(app.getPath('downloads'), 'EasyShare'),
          notificationsEnabled: true,
        },
        pairedDevices: [],
        transfers: [],
      },
    });
  }

  async initialize(): Promise<void> {
    // Ensure save directory exists
    const settings = this.getSettings();
    const fs = await import('fs');
    try {
      await fs.promises.mkdir(settings.saveDirectory, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  // Settings
  getSettings(): AppSettings {
    return this.store.get('settings');
  }

  updateSettings(updates: Partial<AppSettings>): void {
    const current = this.getSettings();
    this.store.set('settings', { ...current, ...updates });
  }

  // Paired Devices
  getPairedDevices(): PairedDevice[] {
    return this.store.get('pairedDevices');
  }

  addPairedDevice(device: PairedDevice): void {
    const devices = this.getPairedDevices();
    const existingIndex = devices.findIndex((d) => d.id === device.id);

    if (existingIndex >= 0) {
      devices[existingIndex] = device;
    } else {
      devices.push(device);
    }

    this.store.set('pairedDevices', devices);
  }

  removePairedDevice(deviceId: string): void {
    const devices = this.getPairedDevices().filter((d) => d.id !== deviceId);
    this.store.set('pairedDevices', devices);
  }

  updatePairedDeviceLastConnected(deviceId: string): void {
    const devices = this.getPairedDevices().map((d) =>
      d.id === deviceId ? { ...d, lastConnected: Date.now() } : d
    );
    this.store.set('pairedDevices', devices);
  }

  // Transfers
  getTransfers(): Transfer[] {
    return this.store.get('transfers');
  }

  addTransfer(transfer: Transfer): void {
    const transfers = this.getTransfers();
    transfers.unshift(transfer); // Add to beginning

    // Keep only last 100 transfers
    if (transfers.length > 100) {
      transfers.splice(100);
    }

    this.store.set('transfers', transfers);
  }

  clearTransfers(): void {
    this.store.set('transfers', []);
  }
}

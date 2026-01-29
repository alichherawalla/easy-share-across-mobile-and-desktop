import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, PairedDevice, Transfer } from '@easyshare/shared';
import { generateDeviceId } from '@easyshare/shared';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  SETTINGS: '@easyshare/settings',
  PAIRED_DEVICES: '@easyshare/paired_devices',
  TRANSFERS: '@easyshare/transfers',
};

const DEFAULT_SETTINGS: AppSettings = {
  deviceName: `Android Device`,
  deviceId: generateDeviceId(),
  autoAcceptFromPaired: true,
  saveDirectory: '/storage/emulated/0/Download/EasyShare',
  notificationsEnabled: true,
};

export function useStorage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [storedSettings, storedPaired, storedTransfers] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.PAIRED_DEVICES),
          AsyncStorage.getItem(STORAGE_KEYS.TRANSFERS),
        ]);

        if (storedSettings) {
          setSettings(JSON.parse(storedSettings));
        } else {
          // First run - create default settings
          const defaultSettings = {
            ...DEFAULT_SETTINGS,
            deviceId: generateDeviceId(),
          };
          await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
          setSettings(defaultSettings);
        }

        if (storedPaired) {
          setPairedDevices(JSON.parse(storedPaired));
        }

        if (storedTransfers) {
          setTransfers(JSON.parse(storedTransfers));
        }
      } catch (error) {
        console.error('Failed to load storage:', error);
        // Set defaults on error
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Settings
  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const newSettings = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings)).catch(console.error);
      return newSettings;
    });
  }, []);

  // Paired Devices
  const addPairedDevice = useCallback(async (device: PairedDevice) => {
    setPairedDevices((prev) => {
      const existingIndex = prev.findIndex((d) => d.id === device.id);
      let newDevices: PairedDevice[];

      if (existingIndex >= 0) {
        newDevices = [...prev];
        newDevices[existingIndex] = device;
      } else {
        newDevices = [...prev, device];
      }

      AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICES, JSON.stringify(newDevices)).catch(
        console.error
      );
      return newDevices;
    });
  }, []);

  const removePairedDevice = useCallback(async (deviceId: string) => {
    setPairedDevices((prev) => {
      const newDevices = prev.filter((d) => d.id !== deviceId);
      AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICES, JSON.stringify(newDevices)).catch(
        console.error
      );
      return newDevices;
    });
  }, []);

  const updatePairedDeviceLastConnected = useCallback(async (deviceId: string) => {
    setPairedDevices((prev) => {
      const newDevices = prev.map((d) =>
        d.id === deviceId ? { ...d, lastConnected: Date.now() } : d
      );
      AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICES, JSON.stringify(newDevices)).catch(
        console.error
      );
      return newDevices;
    });
  }, []);

  // Transfers
  const addTransfer = useCallback(async (transfer: Transfer) => {
    setTransfers((prev) => {
      const newTransfers = [transfer, ...prev];
      // Keep only last 100 transfers
      if (newTransfers.length > 100) {
        newTransfers.splice(100);
      }
      AsyncStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(newTransfers)).catch(
        console.error
      );
      return newTransfers;
    });
  }, []);

  const clearTransfers = useCallback(async () => {
    setTransfers([]);
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify([]));
  }, []);

  return {
    settings,
    pairedDevices,
    transfers,
    isLoading,
    updateSettings,
    addPairedDevice,
    removePairedDevice,
    updatePairedDeviceLastConnected,
    addTransfer,
    clearTransfers,
  };
}

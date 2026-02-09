import { useState, useEffect, useCallback, useRef } from 'react';
import Zeroconf from 'react-native-zeroconf';
import type { DeviceInfo, DiscoveredDevice } from '@easyshare/shared';
import {
  MDNS_SERVICE_TYPE,
  createTxtRecord,
  parseTxtRecord,
  createDiscoveredDevice,
} from '@easyshare/shared';
import { nsdBridge } from '../native/NsdModule';

export function useDiscovery() {
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const zeroconfRef = useRef<Zeroconf | null>(null);
  const localDeviceRef = useRef<DeviceInfo | null>(null);
  const isAdvertisingRef = useRef<boolean>(false);
  const rescanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const readvertiseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    zeroconfRef.current = new Zeroconf();

    zeroconfRef.current.on('resolved', (service) => {
      // Skip our own service
      const deviceId = service.txt?.id;
      if (deviceId === localDeviceRef.current?.id) {
        return;
      }

      // Prefer IPv4 addresses over IPv6
      const addresses = service.addresses || [];
      const ipv4Address = addresses.find((addr: string) => !addr.includes(':'));
      const host = ipv4Address || service.host || addresses[0] || '';
      const port = service.port;

      console.log('Found service:', service.name, 'addresses:', addresses, 'using:', host);

      const deviceInfo = parseTxtRecord(service.txt || {}, host, port);
      if (!deviceInfo) {
        return;
      }

      const discovered = createDiscoveredDevice(deviceInfo);

      setDiscoveredDevices((prev) => {
        const existing = prev.findIndex((d) => d.id === discovered.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = discovered;
          return updated;
        }
        return [...prev, discovered];
      });
    });

    zeroconfRef.current.on('remove', (name) => {
      // Try to extract device ID from service name
      // Service names are like "EasyShare-<id>._easyshare._tcp.local"
      const match = name.match(/EasyShare-([^.]+)/);
      if (match) {
        const partialId = match[1];
        setDiscoveredDevices((prev) =>
          prev.filter((d) => !d.id.startsWith(partialId))
        );
      }
    });

    zeroconfRef.current.on('error', (err) => {
      console.error('Zeroconf error:', err);
    });

    return () => {
      zeroconfRef.current?.stop();
      zeroconfRef.current?.removeDeviceListeners();
    };
  }, []);

  const startDiscovery = useCallback(() => {
    zeroconfRef.current?.scan('easyshare', 'tcp', 'local.');

    // Periodically restart scanning to catch missed announcements
    if (rescanIntervalRef.current) {
      clearInterval(rescanIntervalRef.current);
    }
    rescanIntervalRef.current = setInterval(() => {
      console.log('Periodic discovery re-scan...');
      try {
        zeroconfRef.current?.stop();
      } catch (_) {}
      setTimeout(() => {
        zeroconfRef.current?.scan('easyshare', 'tcp', 'local.');
      }, 500);
    }, 15000); // Re-scan every 15 seconds
  }, []);

  const stopDiscovery = useCallback(() => {
    if (rescanIntervalRef.current) {
      clearInterval(rescanIntervalRef.current);
      rescanIntervalRef.current = null;
    }
    try {
      zeroconfRef.current?.stop();
    } catch (error) {
      // Ignore errors if zeroconf wasn't scanning
    }
  }, []);

  const advertise = useCallback(async (device: DeviceInfo) => {
    localDeviceRef.current = device;

    // Use native NSD module to advertise the service
    try {
      await nsdBridge.registerService(device);
      isAdvertisingRef.current = true;
      console.log('Advertising service:', device.name);
    } catch (error) {
      console.error('Failed to advertise service:', error);
    }

    // Periodically re-register to keep the advertisement fresh
    if (readvertiseIntervalRef.current) {
      clearInterval(readvertiseIntervalRef.current);
    }
    readvertiseIntervalRef.current = setInterval(async () => {
      if (!localDeviceRef.current || !isAdvertisingRef.current) return;
      console.log('Periodic re-advertisement...');
      try {
        await nsdBridge.unregisterService();
      } catch (_) {}
      try {
        await nsdBridge.registerService(localDeviceRef.current);
      } catch (err) {
        console.error('Re-advertisement failed:', err);
      }
    }, 30000); // Re-advertise every 30 seconds
  }, []);

  const stopAdvertising = useCallback(async () => {
    localDeviceRef.current = null;
    if (readvertiseIntervalRef.current) {
      clearInterval(readvertiseIntervalRef.current);
      readvertiseIntervalRef.current = null;
    }
    // Only try to unregister if we were actually advertising
    if (!isAdvertisingRef.current) {
      return;
    }
    try {
      await nsdBridge.unregisterService();
      isAdvertisingRef.current = false;
    } catch (error) {
      console.error('Failed to stop advertising:', error);
    }
  }, []);

  return {
    discoveredDevices,
    startDiscovery,
    stopDiscovery,
    advertise,
    stopAdvertising,
  };
}

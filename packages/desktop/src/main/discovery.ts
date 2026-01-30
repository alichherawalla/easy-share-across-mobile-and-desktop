import { Bonjour, Service } from 'bonjour-service';
import type { DeviceInfo, DiscoveredDevice, DiscoveryService as IDiscoveryService } from '@easyshare/shared';
import {
  MDNS_SERVICE_TYPE,
  createTxtRecord,
  parseTxtRecord,
  createDiscoveredDevice,
} from '@easyshare/shared';

export class DiscoveryService implements IDiscoveryService {
  private bonjour: Bonjour;
  private browser: ReturnType<Bonjour['find']> | null = null;
  private publishedService: any = null;
  private localDevice: DeviceInfo;
  private discoveredDevices: Map<string, DiscoveredDevice> = new Map();
  private onDeviceFoundCallback?: (device: DiscoveredDevice) => void;
  private onDeviceLostCallback?: (deviceId: string) => void;

  constructor(localDevice: DeviceInfo) {
    this.bonjour = new Bonjour();
    this.localDevice = localDevice;
  }

  async start(): Promise<void> {
    console.log('Starting discovery for easyshare services...');
    // Start browsing for other EasyShare services
    this.browser = this.bonjour.find({ type: 'easyshare' }, (service: Service) => {
      console.log('Service callback received:', service.name, service.type);
      this.handleServiceFound(service);
    });

    this.browser.on('down', (service: Service) => {
      console.log('Service down:', service.name);
      this.handleServiceLost(service);
    });

    this.browser.on('up', (service: Service) => {
      console.log('Service up event:', service.name, service.addresses, service.port);
    });
  }

  async stop(): Promise<void> {
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
    await this.stopAdvertising();
    this.bonjour.destroy();
  }

  async advertise(device: DeviceInfo): Promise<void> {
    if (this.publishedService) {
      await this.stopAdvertising();
    }

    const txtRecord = createTxtRecord(device);

    // Use unique name with timestamp to avoid conflicts
    const uniqueSuffix = Date.now().toString(36);
    const serviceName = `EasyShare-${device.id.substring(0, 8)}-${uniqueSuffix}`;

    try {
      this.publishedService = this.bonjour.publish({
        name: serviceName,
        type: 'easyshare',
        port: device.port,
        txt: txtRecord,
      });
      console.log('Advertising service:', serviceName, 'on port', device.port);
    } catch (error) {
      console.error('Failed to advertise service:', error);
    }
  }

  async stopAdvertising(): Promise<void> {
    if (this.publishedService) {
      this.publishedService.stop();
      this.publishedService = null;
    }
  }

  onDeviceFound(callback: (device: DiscoveredDevice) => void): void {
    this.onDeviceFoundCallback = callback;
  }

  onDeviceLost(callback: (deviceId: string) => void): void {
    this.onDeviceLostCallback = callback;
  }

  private handleServiceFound(service: Service): void {
    // Skip our own service
    const txt = service.txt || {};
    const deviceId = txt['id'];
    if (deviceId === this.localDevice.id) {
      return;
    }

    // Get host address - prefer IPv4 over IPv6
    const addresses = service.addresses || [];
    const ipv4Address = addresses.find(addr => !addr.includes(':'));
    const host = ipv4Address || service.host?.replace(/\.local$/, '') || addresses[0] || '';
    const port = service.port;

    console.log('Found service:', service.name, 'addresses:', addresses, 'using:', host);

    const deviceInfo = parseTxtRecord(txt as Record<string, string>, host, port);
    if (!deviceInfo) {
      return;
    }

    const discoveredDevice = createDiscoveredDevice(deviceInfo);
    this.discoveredDevices.set(deviceInfo.id, discoveredDevice);

    if (this.onDeviceFoundCallback) {
      this.onDeviceFoundCallback(discoveredDevice);
    }
  }

  private handleServiceLost(service: Service): void {
    const txt = service.txt || {};
    const deviceId = txt['id'] as string;
    if (deviceId) {
      this.discoveredDevices.delete(deviceId);
      if (this.onDeviceLostCallback) {
        this.onDeviceLostCallback(deviceId);
      }
    }
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }
}

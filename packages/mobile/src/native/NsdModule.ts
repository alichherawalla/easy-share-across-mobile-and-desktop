import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { DeviceInfo } from '@easyshare/shared';

// Type definitions for the native module
interface NsdModuleInterface {
  startDiscovery(serviceType: string): Promise<void>;
  stopDiscovery(): Promise<void>;
  registerService(
    serviceName: string,
    serviceType: string,
    port: number,
    txtRecord: Record<string, string>
  ): Promise<void>;
  unregisterService(): Promise<void>;
}

// The native module (would need to be implemented in Java/Kotlin)
const NsdNativeModule = NativeModules.NsdModule as NsdModuleInterface | undefined;

/**
 * Native Module Bridge for Android NSD (Network Service Discovery)
 *
 * This module provides a bridge to Android's native NSD API for mDNS/Bonjour
 * service discovery and advertising.
 *
 * Note: This requires implementing the native module in Java/Kotlin.
 * See android/app/src/main/java/com/easyshare/NsdModule.java for the implementation.
 */
export class NsdBridge {
  private eventEmitter: NativeEventEmitter | null = null;
  private onServiceFoundCallback?: (service: any) => void;
  private onServiceLostCallback?: (serviceName: string) => void;

  constructor() {
    if (Platform.OS === 'android' && NsdNativeModule) {
      this.eventEmitter = new NativeEventEmitter(NativeModules.NsdModule);

      this.eventEmitter.addListener('onServiceFound', (service) => {
        if (this.onServiceFoundCallback) {
          this.onServiceFoundCallback(service);
        }
      });

      this.eventEmitter.addListener('onServiceLost', (serviceName) => {
        if (this.onServiceLostCallback) {
          this.onServiceLostCallback(serviceName);
        }
      });
    }
  }

  async startDiscovery(serviceType: string = '_easyshare._tcp'): Promise<void> {
    if (!NsdNativeModule) {
      console.warn('NSD native module not available');
      return;
    }
    await NsdNativeModule.startDiscovery(serviceType);
  }

  async stopDiscovery(): Promise<void> {
    if (!NsdNativeModule) return;
    await NsdNativeModule.stopDiscovery();
  }

  async registerService(device: DeviceInfo): Promise<void> {
    if (!NsdNativeModule) {
      console.warn('NSD native module not available');
      return;
    }

    const serviceName = `EasyShare-${device.id.substring(0, 8)}`;
    const txtRecord = {
      id: device.id,
      name: device.name,
      platform: device.platform,
      version: device.version,
    };

    await NsdNativeModule.registerService(serviceName, '_easyshare._tcp', device.port, txtRecord);
  }

  async unregisterService(): Promise<void> {
    if (!NsdNativeModule) return;
    await NsdNativeModule.unregisterService();
  }

  onServiceFound(callback: (service: any) => void): void {
    this.onServiceFoundCallback = callback;
  }

  onServiceLost(callback: (serviceName: string) => void): void {
    this.onServiceLostCallback = callback;
  }

  cleanup(): void {
    this.eventEmitter?.removeAllListeners('onServiceFound');
    this.eventEmitter?.removeAllListeners('onServiceLost');
  }
}

// Export a singleton instance
export const nsdBridge = new NsdBridge();

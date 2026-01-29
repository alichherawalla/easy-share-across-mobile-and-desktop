import { motion } from 'framer-motion';
import { IconRadar2, IconDevices } from '@tabler/icons-react';
import type { DiscoveredDevice, PairedDevice } from '@easyshare/shared';
import { DeviceCard } from '../components/DeviceCard';

interface DiscoveryViewProps {
  discoveredDevices: DiscoveredDevice[];
  pairedDevices: PairedDevice[];
  onConnect: (device: DiscoveredDevice) => void;
  onUnpair: (deviceId: string) => void;
}

export function DiscoveryView({
  discoveredDevices,
  pairedDevices,
  onConnect,
  onUnpair,
}: DiscoveryViewProps) {
  // Separate paired and unpaired devices
  const pairedIds = new Set(pairedDevices.map((d) => d.id));
  const pairedDiscovered = discoveredDevices.filter((d) => pairedIds.has(d.id));
  const unpairedDiscovered = discoveredDevices.filter((d) => !pairedIds.has(d.id));

  const isEmpty = discoveredDevices.length === 0;

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-light text-white mb-2">Devices</h1>
          <p className="text-neutral-500">
            {isEmpty
              ? 'Searching for nearby devices...'
              : `${discoveredDevices.length} device${discoveredDevices.length !== 1 ? 's' : ''} found`}
          </p>
        </motion.div>

        {/* Empty state */}
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-ping">
                <IconRadar2 size={64} className="text-neutral-700" stroke={1} />
              </div>
              <IconRadar2 size={64} className="text-neutral-600" stroke={1} />
            </div>
            <p className="text-neutral-500 text-center max-w-sm">
              Make sure both devices are on the same network and the EasyShare app is running.
            </p>
          </motion.div>
        )}

        {/* Paired devices section */}
        {pairedDiscovered.length > 0 && (
          <div className="mb-8">
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-4"
            >
              Paired Devices
            </motion.h2>
            <div className="grid gap-4">
              {pairedDiscovered.map((device, index) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  isPaired={true}
                  pairedInfo={pairedDevices.find((d) => d.id === device.id)}
                  onConnect={() => onConnect(device)}
                  onUnpair={() => onUnpair(device.id)}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Available devices section */}
        {unpairedDiscovered.length > 0 && (
          <div>
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-4"
            >
              Available Devices
            </motion.h2>
            <div className="grid gap-4">
              {unpairedDiscovered.map((device, index) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  isPaired={false}
                  onConnect={() => onConnect(device)}
                  index={index + pairedDiscovered.length}
                />
              ))}
            </div>
          </div>
        )}

        {/* Offline paired devices */}
        {pairedDevices.filter((d) => !discoveredDevices.some((dd) => dd.id === d.id)).length > 0 && (
          <div className="mt-8">
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-4"
            >
              Offline
            </motion.h2>
            <div className="space-y-2">
              {pairedDevices
                .filter((d) => !discoveredDevices.some((dd) => dd.id === d.id))
                .map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/30 border border-neutral-800/30"
                  >
                    <div className="flex items-center gap-3">
                      <IconDevices size={18} className="text-neutral-600" />
                      <span className="text-neutral-600">{device.name}</span>
                    </div>
                    <button
                      onClick={() => onUnpair(device.id)}
                      className="text-sm text-neutral-600 hover:text-neutral-400 transition-colors"
                    >
                      Unpair
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

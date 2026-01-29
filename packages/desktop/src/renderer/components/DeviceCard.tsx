import { motion } from 'framer-motion';
import { IconDeviceMobile, IconDeviceDesktop, IconLink } from '@tabler/icons-react';
import type { DiscoveredDevice, PairedDevice } from '@easyshare/shared';
import { BorderBeam } from './BorderBeam';

interface DeviceCardProps {
  device: DiscoveredDevice;
  isPaired: boolean;
  pairedInfo?: PairedDevice;
  onConnect: () => void;
  onUnpair?: () => void;
  index: number;
  isActive?: boolean;
}

export function DeviceCard({
  device,
  isPaired,
  pairedInfo,
  onConnect,
  onUnpair,
  index,
  isActive = false,
}: DeviceCardProps) {
  const Icon = device.platform === 'android' ? IconDeviceMobile : IconDeviceDesktop;

  const formatLastConnected = (timestamp?: number) => {
    if (!timestamp) return 'Never connected';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`
        relative group rounded-xl overflow-hidden
        bg-neutral-900/60 border border-neutral-800
        hover:border-neutral-700 transition-colors duration-200
      `}
    >
      {isActive && <BorderBeam />}

      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-neutral-800/60">
              <Icon size={24} stroke={1.5} className="text-neutral-300" />
            </div>

            <div>
              <h3 className="text-white font-medium">{device.name}</h3>
              <p className="text-sm text-neutral-500 mt-0.5">
                {device.platform === 'android' ? 'Android' : 'macOS'}
                {isPaired && (
                  <span className="ml-2 text-neutral-400">
                    {formatLastConnected(pairedInfo?.lastConnected)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {isPaired && (
            <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-xs text-neutral-400">
              Paired
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onConnect}
            className={`
              flex-1 flex items-center justify-center gap-2 py-2.5 px-4
              rounded-lg font-medium text-sm transition-all duration-200
              ${isPaired
                ? 'bg-white text-neutral-900 hover:bg-neutral-200'
                : 'bg-neutral-800 text-white hover:bg-neutral-700'
              }
            `}
          >
            <IconLink size={16} stroke={2} />
            {isPaired ? 'Connect' : 'Pair'}
          </button>

          {isPaired && onUnpair && (
            <button
              onClick={onUnpair}
              className="py-2.5 px-4 rounded-lg text-sm text-neutral-500
                hover:text-white hover:bg-neutral-800 transition-colors duration-200"
            >
              Unpair
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

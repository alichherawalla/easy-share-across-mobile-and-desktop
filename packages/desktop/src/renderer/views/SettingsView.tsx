import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  IconDeviceDesktop,
  IconFolder,
  IconBell,
  IconCheck,
  IconDevices,
  IconTrash,
  IconDeviceMobile,
} from '@tabler/icons-react';
import type { AppSettings, PairedDevice } from '@easyshare/shared';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
  pairedDevices?: PairedDevice[];
  onUnpair?: (deviceId: string) => void;
}

export function SettingsView({ settings, onUpdate, pairedDevices = [], onUnpair }: SettingsViewProps) {
  const [deviceName, setDeviceName] = useState(settings.deviceName);
  const [hasChanges, setHasChanges] = useState(false);

  const handleDeviceNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeviceName(e.target.value);
    setHasChanges(e.target.value !== settings.deviceName);
  };

  const handleSaveDeviceName = () => {
    if (deviceName.trim() && deviceName !== settings.deviceName) {
      onUpdate({ deviceName: deviceName.trim() });
      setHasChanges(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-light text-white mb-2">Settings</h1>
          <p className="text-neutral-500">Configure your EasyShare preferences</p>
        </motion.div>

        <div className="space-y-6">
          {/* Device section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-neutral-800">
                <IconDeviceDesktop size={18} className="text-neutral-300" />
              </div>
              <h2 className="text-lg font-medium text-white">Device</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-500 mb-2">
                  Device Name
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={deviceName}
                    onChange={handleDeviceNameChange}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700
                      text-white placeholder-neutral-500
                      focus:outline-none focus:border-neutral-600
                      transition-colors duration-200"
                  />
                  {hasChanges && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={handleSaveDeviceName}
                      className="px-4 py-2.5 rounded-lg bg-white text-neutral-900
                        font-medium hover:bg-neutral-200 transition-colors"
                    >
                      Save
                    </motion.button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-500 mb-2">
                  Device ID
                </label>
                <p className="text-neutral-400 font-mono text-sm">
                  {settings.deviceId}
                </p>
              </div>
            </div>
          </motion.section>

          {/* Storage section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-neutral-800">
                <IconFolder size={18} className="text-neutral-300" />
              </div>
              <h2 className="text-lg font-medium text-white">Storage</h2>
            </div>

            <div>
              <label className="block text-sm text-neutral-500 mb-2">
                Save Location
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 px-4 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700">
                  <p className="text-neutral-400 text-sm truncate">
                    {settings.saveDirectory}
                  </p>
                </div>
                <button
                  className="px-4 py-2.5 rounded-lg bg-neutral-800 text-neutral-300
                    hover:bg-neutral-700 transition-colors"
                >
                  Change
                </button>
              </div>
            </div>
          </motion.section>

          {/* Preferences section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-neutral-800">
                <IconBell size={18} className="text-neutral-300" />
              </div>
              <h2 className="text-lg font-medium text-white">Preferences</h2>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="text-white">Auto-accept from paired devices</p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    Automatically accept file transfers from devices you've paired with
                  </p>
                </div>
                <button
                  onClick={() => onUpdate({ autoAcceptFromPaired: !settings.autoAcceptFromPaired })}
                  className={`
                    w-12 h-7 rounded-full transition-colors duration-200
                    ${settings.autoAcceptFromPaired
                      ? 'bg-white'
                      : 'bg-neutral-700'
                    }
                  `}
                >
                  <motion.div
                    className={`
                      w-5 h-5 rounded-full mx-1
                      ${settings.autoAcceptFromPaired
                        ? 'bg-neutral-900'
                        : 'bg-neutral-500'
                      }
                    `}
                    animate={{
                      x: settings.autoAcceptFromPaired ? 20 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="text-white">Notifications</p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    Show notifications for incoming transfers
                  </p>
                </div>
                <button
                  onClick={() => onUpdate({ notificationsEnabled: !settings.notificationsEnabled })}
                  className={`
                    w-12 h-7 rounded-full transition-colors duration-200
                    ${settings.notificationsEnabled
                      ? 'bg-white'
                      : 'bg-neutral-700'
                    }
                  `}
                >
                  <motion.div
                    className={`
                      w-5 h-5 rounded-full mx-1
                      ${settings.notificationsEnabled
                        ? 'bg-neutral-900'
                        : 'bg-neutral-500'
                      }
                    `}
                    animate={{
                      x: settings.notificationsEnabled ? 20 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </label>
            </div>
          </motion.section>

          {/* Paired Devices section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-neutral-800">
                <IconDevices size={18} className="text-neutral-300" />
              </div>
              <h2 className="text-lg font-medium text-white">Paired Devices</h2>
            </div>

            {pairedDevices.length === 0 ? (
              <div className="text-center py-8">
                <IconDeviceMobile size={32} className="text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500 text-sm">No paired devices</p>
                <p className="text-neutral-600 text-xs mt-1">
                  Devices you pair with will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pairedDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-neutral-800/50 border border-neutral-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-neutral-700/50">
                        {device.platform === 'android' ? (
                          <IconDeviceMobile size={18} className="text-neutral-400" />
                        ) : (
                          <IconDeviceDesktop size={18} className="text-neutral-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{device.name}</p>
                        <p className="text-neutral-500 text-xs">
                          Paired {device.pairedAt ? new Date(device.pairedAt).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onUnpair?.(device.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <IconTrash size={16} />
                      <span className="text-sm">Forget</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          {/* About section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/50"
          >
            <div className="text-center">
              <h3 className="text-white font-medium">EasyShare</h3>
              <p className="text-neutral-500 text-sm mt-1">Version 1.0.0</p>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

import { motion } from 'framer-motion';
import {
  IconDevices,
  IconHistory,
  IconSettings,
  IconPlugConnected,
} from '@tabler/icons-react';
import type { ConnectionState } from '@easyshare/shared';

type View = 'discovery' | 'connected' | 'history' | 'settings';

interface HeaderProps {
  currentView: View;
  onViewChange: (view: View) => void;
  connectionState: ConnectionState;
}

export function Header({ currentView, onViewChange, connectionState }: HeaderProps) {
  const isConnected = connectionState.status === 'connected' || connectionState.status === 'pairing';

  const navItems: { id: View; icon: typeof IconDevices; label: string }[] = [
    { id: 'discovery', icon: IconDevices, label: 'Devices' },
    { id: 'history', icon: IconHistory, label: 'History' },
    { id: 'settings', icon: IconSettings, label: 'Settings' },
  ];

  // Insert connected tab if connected or pairing
  if (isConnected && connectionState.device) {
    navItems.splice(1, 0, {
      id: 'connected',
      icon: IconPlugConnected,
      label: connectionState.status === 'pairing' ? 'Pairing' : 'Connected',
    });
  }

  return (
    <header className="app-no-drag px-6 pb-4 border-b border-neutral-800/50">
      <nav className="flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`
                relative px-4 py-2 rounded-lg flex items-center gap-2
                transition-colors duration-200
                ${isActive
                  ? 'text-white'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40'
                }
              `}
            >
              <Icon size={18} stroke={1.5} />
              <span className="text-sm font-medium">{item.label}</span>

              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-neutral-800/60 rounded-lg -z-10"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}

              {item.id === 'connected' && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

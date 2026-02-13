import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  DiscoveredDevice,
  PairedDevice,
  Transfer,
  TransferProgress,
  TransferQueueItem,
  ConnectionState,
  AppSettings,
} from '@easyshare/shared';
import { Header } from './components/Header';
import { DiscoveryView } from './views/DiscoveryView';
import { ConnectedView } from './views/ConnectedView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { PairingModal } from './components/PairingModal';

type View = 'discovery' | 'connected' | 'history' | 'settings';

export default function App() {
  const [view, setView] = useState<View>('discovery');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
  });
  const [currentProgress, setCurrentProgress] = useState<TransferProgress | null>(null);
  const [transferQueue, setTransferQueue] = useState<TransferQueueItem[]>([]);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [pairingDevice, setPairingDevice] = useState<DiscoveredDevice | null>(null);
  const [isIncomingPairing, setIsIncomingPairing] = useState(false);

  // Initialize app state
  useEffect(() => {
    const init = async () => {
      const state = await window.api.getState();
      setSettings(state.settings);
      setPairedDevices(state.pairedDevices);
      setTransfers(state.transfers);
    };
    init();
  }, []);

  // Set up event listeners
  useEffect(() => {
    const unsubDeviceFound = window.api.onDeviceFound((device) => {
      setDiscoveredDevices((prev) => {
        const existing = prev.findIndex((d) => d.id === device.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = device;
          return updated;
        }
        return [...prev, device];
      });
    });

    const unsubDeviceLost = window.api.onDeviceLost((deviceId) => {
      setDiscoveredDevices((prev) => prev.filter((d) => d.id !== deviceId));
    });

    const unsubConnectionState = window.api.onConnectionState(async (state) => {
      setConnectionState(state);
      if (state.status === 'connected') {
        // Refresh paired devices to check if pairing just completed
        const appState = await window.api.getState();
        setPairedDevices(appState.pairedDevices);

        // Check if device is now paired
        const deviceIsPaired = state.device &&
          appState.pairedDevices.some((d) => d.id === state.device?.id);

        if (deviceIsPaired) {
          // Pairing completed - close modal and switch to connected view
          setShowPairingModal(false);
          setPairingDevice(null);
          setIsIncomingPairing(false);
          setView('connected');
        }
      } else if (state.status === 'disconnected') {
        if (view === 'connected') {
          setView('discovery');
        }
      }
    });

    const unsubProgress = window.api.onTransferProgress((progress) => {
      if (!progress) return;
      setCurrentProgress(progress);
      // Update active queue item's progress
      setTransferQueue((prev) => {
        if (prev.length === 0) return prev;
        const activeIdx = prev.findIndex((item) => item.status === 'transferring');
        if (activeIdx < 0) return prev;
        return prev.map((item, idx) =>
          idx === activeIdx ? { ...item, progress: progress.percentage } : item
        );
      });
    });

    const unsubComplete = window.api.onTransferComplete((transfer) => {
      setTransfers((prev) => [transfer, ...prev]);
      setCurrentProgress(null);
    });

    const unsubPairingRequest = window.api.onPairingRequest((device) => {
      console.log('Incoming pairing request from:', device.name);
      setPairingDevice(device as DiscoveredDevice);
      setIsIncomingPairing(true);
      setShowPairingModal(true);
    });

    return () => {
      unsubDeviceFound();
      unsubDeviceLost();
      unsubConnectionState();
      unsubProgress();
      unsubComplete();
      unsubPairingRequest();
    };
  }, [view, showPairingModal, pairedDevices]);

  const handleConnect = useCallback(async (device: DiscoveredDevice) => {
    // Check if already paired
    const isPaired = pairedDevices.some((d) => d.id === device.id);

    if (isPaired) {
      // Direct connect
      await window.api.connectToDevice(device);
    } else {
      // Need to pair first - show modal (don't connect yet)
      setPairingDevice(device);
      setIsIncomingPairing(false);
      setShowPairingModal(true);
    }
  }, [pairedDevices]);

  const handlePair = useCallback(async (passphrase: string) => {
    if (!pairingDevice) return;

    if (isIncomingPairing) {
      // Responding to an incoming pairing request
      await window.api.respondToPairing(passphrase);
    } else {
      // Initiating pairing - connect first, then start pairing
      const connected = await window.api.connectToDevice(pairingDevice);
      if (connected) {
        await window.api.startPairing(pairingDevice.id, passphrase);
      }
    }
  }, [pairingDevice, isIncomingPairing]);

  const handleDisconnect = useCallback(async () => {
    await window.api.disconnectDevice();
  }, []);

  const handleSendText = useCallback(async (text: string) => {
    await window.api.sendText(text);
  }, []);

  const handleSendFile = useCallback(async (filePath: string) => {
    await window.api.sendFile(filePath);
  }, []);

  const handleCancelTransfer = useCallback(async () => {
    await window.api.cancelTransfer();
    setCurrentProgress(null);
    setTransferQueue([]);
  }, []);

  const handleSendFiles = useCallback(async (filePaths: string[]) => {
    if (filePaths.length <= 1) {
      // Single file — no queue needed
      if (filePaths.length === 1) await window.api.sendFile(filePaths[0]);
      return;
    }

    // Build queue items
    const queueItems: TransferQueueItem[] = filePaths.map((fp, i) => ({
      id: `queue-${Date.now()}-${i}`,
      fileName: fp.split('/').pop() || fp.split('\\').pop() || fp,
      fileSize: 0,
      status: 'pending' as const,
      progress: 0,
      direction: 'send' as const,
    }));
    setTransferQueue(queueItems);

    // Send files sequentially, updating queue status
    for (let i = 0; i < filePaths.length; i++) {
      setTransferQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'transferring' } : item
        )
      );
      const success = await window.api.sendFile(filePaths[i]);
      setTransferQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: success ? 'completed' : 'failed', progress: success ? 100 : item.progress } : item
        )
      );
    }

    // Clear queue after 3 seconds
    setTimeout(() => setTransferQueue([]), 3000);
  }, []);

  const handleUnpair = useCallback(async (deviceId: string) => {
    const devices = await window.api.unpairDevice(deviceId);
    setPairedDevices(devices);
  }, []);

  const handleClearHistory = useCallback(async () => {
    await window.api.clearTransfers();
    setTransfers([]);
  }, []);

  const handleUpdateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const newSettings = await window.api.updateSettings(updates);
    setSettings(newSettings);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      {/* Draggable title bar area */}
      <div className="app-drag-region h-[52px] flex-shrink-0" />

      {/* Header */}
      <Header
        currentView={view}
        onViewChange={setView}
        connectionState={connectionState}
      />

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'discovery' && (
            <motion.div
              key="discovery"
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <DiscoveryView
                discoveredDevices={discoveredDevices}
                pairedDevices={pairedDevices}
                onConnect={handleConnect}
                onUnpair={handleUnpair}
              />
            </motion.div>
          )}

          {view === 'connected' && connectionState.device && (connectionState.status === 'connected' || connectionState.status === 'pairing') && (
            <motion.div
              key="connected"
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <ConnectedView
                device={connectionState.device}
                onDisconnect={handleDisconnect}
                onSendText={handleSendText}
                onSendFile={handleSendFile}
                onSendFiles={handleSendFiles}
                onCancelTransfer={handleCancelTransfer}
                currentProgress={currentProgress}
                transfers={transfers}
                transferQueue={transferQueue}
              />
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <HistoryView
                transfers={transfers}
                onClear={handleClearHistory}
              />
            </motion.div>
          )}

          {view === 'settings' && settings && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, filter: 'blur(10px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <SettingsView
                settings={settings}
                onUpdate={handleUpdateSettings}
                pairedDevices={pairedDevices}
                onUnpair={handleUnpair}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Pairing Modal */}
      <PairingModal
        isOpen={showPairingModal}
        device={pairingDevice}
        onClose={() => {
          setShowPairingModal(false);
          setPairingDevice(null);
          setIsIncomingPairing(false);
        }}
        onPair={handlePair}
        connectionState={connectionState}
        isIncoming={isIncomingPairing}
      />
    </div>
  );
}

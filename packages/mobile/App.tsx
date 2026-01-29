import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type {
  DiscoveredDevice,
  PairedDevice,
  Transfer,
  TransferProgress,
  ConnectionState,
  AppSettings,
} from '@easyshare/shared';

import { Header } from './src/components/Header';
import { DiscoveryScreen } from './src/screens/DiscoveryScreen';
import { ConnectedScreen } from './src/screens/ConnectedScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PairingModal } from './src/components/PairingModal';
import { useDiscovery } from './src/hooks/useDiscovery';
import { useConnection } from './src/hooks/useConnection';
import { useStorage } from './src/hooks/useStorage';

type ViewType = 'discovery' | 'connected' | 'history' | 'settings';

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function App(): React.JSX.Element {
  const [view, setView] = useState<ViewType>('discovery');
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [pairingDevice, setPairingDevice] = useState<DiscoveredDevice | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<DiscoveredDevice | null>(null);

  const {
    settings,
    pairedDevices,
    transfers,
    updateSettings,
    addPairedDevice,
    removePairedDevice,
    addTransfer,
    clearTransfers,
    isLoading,
  } = useStorage();

  const {
    discoveredDevices,
    startDiscovery,
    stopDiscovery,
    advertise,
    stopAdvertising,
  } = useDiscovery();

  const {
    connectionState,
    currentProgress,
    serverPort,
    connect,
    disconnect,
    startPairing,
    respondToPairing,
    sendText,
    sendFile,
    startServer,
    stopServer,
    onPairingSuccess,
    onTransferComplete,
    onTextReceived,
    onPairingRequest,
    setLocalDevice,
  } = useConnection();

  // Track if we're responding to an incoming pairing request
  const [isIncomingPairing, setIsIncomingPairing] = useState(false);

  // Start server and discovery on mount
  useEffect(() => {
    if (settings) {
      // Set local device info for pairing
      const localDevice = {
        id: settings.deviceId,
        name: settings.deviceName,
        platform: 'android' as const,
        version: '1.0.0',
        host: '',
        port: 0,
      };
      setLocalDevice(localDevice);

      // Start the TCP server first, then advertise with the actual port
      startServer().then((port) => {
        console.log('Server started on port:', port);
        // Update local device with actual port
        setLocalDevice({ ...localDevice, port });
        startDiscovery();
        advertise({
          ...localDevice,
          port: port,
        });
      }).catch((error) => {
        console.error('Failed to start server:', error);
        // Still start discovery even if server fails
        startDiscovery();
      });
    }

    return () => {
      stopDiscovery();
      stopAdvertising();
      stopServer();
    };
  }, [settings?.deviceId]);

  // Handle connection state changes - only switch view on status transitions
  const prevStatusRef = React.useRef(connectionState.status);
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = connectionState.status;

    // Update connected device when we have one
    if (connectionState.device) {
      setConnectedDevice(connectionState.device as DiscoveredDevice);
    }

    // Only act on status changes, not on every render
    if (prevStatus === connectionState.status) return;

    if (connectionState.status === 'connected' && prevStatus !== 'connected') {
      // Just connected - switch to connected view and close modal if device is paired
      const deviceIsPaired = connectionState.device &&
        pairedDevices.some((d) => d.id === connectionState.device?.id);

      if (!showPairingModal || deviceIsPaired) {
        setShowPairingModal(false);
        setPairingDevice(null);
        setView('connected');
      }
    } else if (connectionState.status === 'disconnected' && prevStatus !== 'disconnected') {
      // Just disconnected - clear connected device and switch to discovery
      setConnectedDevice(null);
      if (view === 'connected') {
        setView('discovery');
      }
    }
  }, [connectionState.status, connectionState.device, pairedDevices, showPairingModal, view]);

  // Set up callbacks
  useEffect(() => {
    onPairingSuccess((pairedDevice) => {
      addPairedDevice(pairedDevice);
      setIsIncomingPairing(false);
    });

    onTransferComplete((transfer) => {
      console.log('App: Transfer complete callback fired', transfer.id, transfer.type);
      addTransfer(transfer);
    });

    onTextReceived((text, device) => {
      // Handle received text (could show notification)
    });

    onPairingRequest((device) => {
      // Incoming pairing request from another device
      console.log('Incoming pairing request from:', device.name);
      setPairingDevice(device as DiscoveredDevice);
      setIsIncomingPairing(true);
      setShowPairingModal(true);
    });
  }, []);

  const handleConnect = useCallback(async (device: DiscoveredDevice) => {
    const isPaired = pairedDevices.some((d) => d.id === device.id);

    if (isPaired) {
      // Already paired - just connect
      await connect(device);
    } else {
      // Not paired - show pairing modal (don't connect yet)
      setPairingDevice(device);
      setShowPairingModal(true);
    }
  }, [pairedDevices, connect]);

  const handlePair = useCallback(async (passphrase: string) => {
    if (!pairingDevice) return;

    if (isIncomingPairing) {
      // We're responding to an incoming pairing request
      // The connection is already established, just provide the passphrase
      respondToPairing(passphrase);
    } else {
      // We're initiating the pairing - connect first, then start pairing
      const connected = await connect(pairingDevice);
      if (connected) {
        await startPairing(pairingDevice.id, passphrase);
      }
    }
  }, [pairingDevice, isIncomingPairing, connect, startPairing, respondToPairing]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleSendText = useCallback(async (text: string) => {
    await sendText(text);
  }, [sendText]);

  const handleSendFile = useCallback(async (filePath: string, fileName?: string) => {
    await sendFile(filePath, fileName);
  }, [sendFile]);

  const handleUnpair = useCallback(async (deviceId: string) => {
    removePairedDevice(deviceId);
  }, [removePairedDevice]);

  const handleClearHistory = useCallback(async () => {
    clearTransfers();
  }, [clearTransfers]);

  const handleUpdateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    updateSettings(updates);
  }, [updateSettings]);

  if (isLoading || !settings) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const isConnected = (connectionState.status === 'connected' || connectionState.status === 'pairing') && connectedDevice !== null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <SafeAreaView style={styles.container}>
        <Header
          currentView={view}
          onViewChange={setView}
          isConnected={isConnected}
        />

        <View style={styles.flex1}>
          {view === 'discovery' && (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              style={styles.flex1}
            >
              <DiscoveryScreen
                discoveredDevices={discoveredDevices}
                pairedDevices={pairedDevices}
                onConnect={handleConnect}
                onUnpair={handleUnpair}
              />
            </Animated.View>
          )}

          {view === 'connected' && connectedDevice && (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              style={styles.flex1}
            >
              <ConnectedScreen
                device={connectedDevice}
                onDisconnect={handleDisconnect}
                onSendText={handleSendText}
                onSendFile={handleSendFile}
                currentProgress={currentProgress}
                transfers={transfers}
              />
            </Animated.View>
          )}

          {view === 'history' && (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              style={styles.flex1}
            >
              <HistoryScreen
                transfers={transfers}
                onClear={handleClearHistory}
              />
            </Animated.View>
          )}

          {view === 'settings' && (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              style={styles.flex1}
            >
              <SettingsScreen
                settings={settings}
                onUpdate={handleUpdateSettings}
              />
            </Animated.View>
          )}
        </View>

        <PairingModal
          visible={showPairingModal}
          device={pairingDevice}
          onClose={() => {
            setShowPairingModal(false);
            setPairingDevice(null);
            setIsIncomingPairing(false);
          }}
          onPair={handlePair}
          connectionState={connectionState}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;

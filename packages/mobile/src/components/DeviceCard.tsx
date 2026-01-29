import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { DiscoveredDevice, PairedDevice } from '@easyshare/shared';

interface DeviceCardProps {
  device: DiscoveredDevice;
  isPaired: boolean;
  pairedInfo?: PairedDevice;
  onConnect: () => void;
  onUnpair?: () => void;
  index: number;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: 'rgba(23, 23, 23, 0.6)',
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(38, 38, 38, 0.6)',
  },
  iconText: {
    fontSize: 18,
  },
  deviceName: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 16,
  },
  devicePlatform: {
    fontSize: 14,
    color: '#737373',
    marginTop: 2,
  },
  lastConnected: {
    color: '#a3a3a3',
  },
  pairedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#262626',
  },
  pairedBadgeText: {
    fontSize: 12,
    color: '#a3a3a3',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  connectButtonPaired: {
    backgroundColor: '#ffffff',
  },
  connectButtonUnpaired: {
    backgroundColor: '#262626',
  },
  connectButtonText: {
    fontWeight: '500',
    fontSize: 14,
  },
  connectButtonTextPaired: {
    color: '#171717',
  },
  connectButtonTextUnpaired: {
    color: '#ffffff',
  },
  unpairButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  unpairButtonText: {
    fontSize: 14,
    color: '#737373',
  },
});

export function DeviceCard({
  device,
  isPaired,
  pairedInfo,
  onConnect,
  onUnpair,
  index,
}: DeviceCardProps) {
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
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      style={styles.card}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.deviceInfo}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>
                {device.platform === 'android' ? '📱' : '💻'}
              </Text>
            </View>

            <View>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.devicePlatform}>
                {device.platform === 'android' ? 'Android' : 'macOS'}
                {isPaired && (
                  <Text style={styles.lastConnected}>
                    {' '}{formatLastConnected(pairedInfo?.lastConnected)}
                  </Text>
                )}
              </Text>
            </View>
          </View>

          {isPaired && (
            <View style={styles.pairedBadge}>
              <Text style={styles.pairedBadgeText}>Paired</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onConnect}
            style={[
              styles.connectButton,
              isPaired ? styles.connectButtonPaired : styles.connectButtonUnpaired,
            ]}
          >
            <Text
              style={[
                styles.connectButtonText,
                isPaired
                  ? styles.connectButtonTextPaired
                  : styles.connectButtonTextUnpaired,
              ]}
            >
              {isPaired ? 'Connect' : 'Pair'}
            </Text>
          </TouchableOpacity>

          {isPaired && onUnpair && (
            <TouchableOpacity onPress={onUnpair} style={styles.unpairButton}>
              <Text style={styles.unpairButtonText}>Unpair</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

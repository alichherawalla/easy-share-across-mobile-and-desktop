import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { DiscoveredDevice, PairedDevice } from '@easyshare/shared';
import { DeviceCard } from '../components/DeviceCard';

interface DiscoveryScreenProps {
  discoveredDevices: DiscoveredDevice[];
  pairedDevices: PairedDevice[];
  onConnect: (device: DiscoveredDevice) => void;
  onUnpair: (deviceId: string) => void;
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '300',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    color: '#737373',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#737373',
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  deviceList: {
    gap: 16,
  },
  offlineSection: {
    marginTop: 8,
  },
  offlineList: {
    gap: 8,
  },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(23, 23, 23, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(38, 38, 38, 0.3)',
  },
  offlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  offlineIcon: {
    color: '#525252',
  },
  offlineName: {
    color: '#525252',
  },
  unpairText: {
    fontSize: 14,
    color: '#525252',
  },
  bottomPadding: {
    height: 32,
  },
});

export function DiscoveryScreen({
  discoveredDevices,
  pairedDevices,
  onConnect,
  onUnpair,
}: DiscoveryScreenProps) {
  const pairedIds = new Set(pairedDevices.map((d) => d.id));
  const pairedDiscovered = discoveredDevices.filter((d) => pairedIds.has(d.id));
  const unpairedDiscovered = discoveredDevices.filter((d) => !pairedIds.has(d.id));

  const isEmpty = discoveredDevices.length === 0;

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Text style={styles.title}>Devices</Text>
        <Text style={styles.subtitle}>
          {isEmpty
            ? 'Searching for nearby devices...'
            : `${discoveredDevices.length} device${
                discoveredDevices.length !== 1 ? 's' : ''
              } found`}
        </Text>
      </Animated.View>

      {isEmpty && (
        <Animated.View
          entering={FadeIn.delay(300).duration(300)}
          style={styles.emptyState}
        >
          <ActivityIndicator size="large" color="#525252" />
          <Text style={styles.emptyText}>
            Make sure both devices are on the same network and the EasyShare app is running.
          </Text>
        </Animated.View>
      )}

      {pairedDiscovered.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paired Devices</Text>
          <View style={styles.deviceList}>
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
          </View>
        </View>
      )}

      {unpairedDiscovered.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Devices</Text>
          <View style={styles.deviceList}>
            {unpairedDiscovered.map((device, index) => (
              <DeviceCard
                key={device.id}
                device={device}
                isPaired={false}
                onConnect={() => onConnect(device)}
                index={index + pairedDiscovered.length}
              />
            ))}
          </View>
        </View>
      )}

      {pairedDevices.filter(
        (d) => !discoveredDevices.some((dd) => dd.id === d.id)
      ).length > 0 && (
        <View style={styles.offlineSection}>
          <Text style={styles.sectionTitle}>Offline</Text>
          <View style={styles.offlineList}>
            {pairedDevices
              .filter((d) => !discoveredDevices.some((dd) => dd.id === d.id))
              .map((device) => (
                <View key={device.id} style={styles.offlineCard}>
                  <View style={styles.offlineInfo}>
                    <Text style={styles.offlineIcon}>📱</Text>
                    <Text style={styles.offlineName}>{device.name}</Text>
                  </View>
                  <Text
                    onPress={() => onUnpair(device.id)}
                    style={styles.unpairText}
                  >
                    Unpair
                  </Text>
                </View>
              ))}
          </View>
        </View>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

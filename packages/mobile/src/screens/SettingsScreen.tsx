import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { AppSettings, PairedDevice } from '@easyshare/shared';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
  pairedDevices?: PairedDevice[];
  onUnpair?: (deviceId: string) => void;
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
  sectionsContainer: {
    gap: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(23, 23, 23, 0.6)',
    borderWidth: 1,
    borderColor: '#262626',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  cardIcon: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
  },
  cardContent: {
    gap: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#737373',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#404040',
    color: '#ffffff',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  saveButtonText: {
    color: '#171717',
    fontWeight: '500',
  },
  deviceIdText: {
    color: '#a3a3a3',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  directoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  directoryDisplay: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#404040',
  },
  directoryText: {
    color: '#a3a3a3',
    fontSize: 14,
  },
  changeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  changeButtonText: {
    color: '#d4d4d4',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    color: '#ffffff',
  },
  switchDescription: {
    fontSize: 14,
    color: '#737373',
    marginTop: 2,
  },
  aboutCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(23, 23, 23, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(38, 38, 38, 0.5)',
  },
  aboutContent: {
    alignItems: 'center',
  },
  aboutTitle: {
    color: '#ffffff',
    fontWeight: '500',
  },
  aboutVersion: {
    color: '#737373',
    fontSize: 14,
    marginTop: 4,
  },
  bottomPadding: {
    height: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyText: {
    color: '#737373',
    fontSize: 14,
  },
  emptySubtext: {
    color: '#525252',
    fontSize: 12,
    marginTop: 4,
  },
  deviceList: {
    gap: 12,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(38, 38, 38, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(64, 64, 64, 0.5)',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceIconContainer: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(64, 64, 64, 0.5)',
  },
  deviceName: {
    color: '#ffffff',
    fontWeight: '500',
  },
  deviceDate: {
    color: '#737373',
    fontSize: 12,
    marginTop: 2,
  },
  forgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  forgetButtonText: {
    color: '#f87171',
    fontSize: 14,
  },
});

export function SettingsScreen({ settings, onUpdate, pairedDevices = [], onUnpair }: SettingsScreenProps) {
  const [deviceName, setDeviceName] = useState(settings.deviceName);
  const [hasChanges, setHasChanges] = useState(false);

  const handleDeviceNameChange = (text: string) => {
    setDeviceName(text);
    setHasChanges(text !== settings.deviceName);
  };

  const handleSaveDeviceName = () => {
    if (deviceName.trim() && deviceName !== settings.deviceName) {
      onUpdate({ deviceName: deviceName.trim() });
      setHasChanges(false);
    }
  };

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Configure your EasyShare preferences
        </Text>
      </Animated.View>

      <View style={styles.sectionsContainer}>
        {/* Device section */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(300)}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Text>📱</Text>
            </View>
            <Text style={styles.cardTitle}>Device</Text>
          </View>

          <View style={styles.cardContent}>
            <View>
              <Text style={styles.fieldLabel}>Device Name</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={deviceName}
                  onChangeText={handleDeviceNameChange}
                  style={styles.input}
                />
                {hasChanges && (
                  <TouchableOpacity
                    onPress={handleSaveDeviceName}
                    style={styles.saveButton}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>Device ID</Text>
              <Text style={styles.deviceIdText} selectable>
                {settings.deviceId}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Storage section */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(300)}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Text>📁</Text>
            </View>
            <Text style={styles.cardTitle}>Storage</Text>
          </View>

          <View>
            <Text style={styles.fieldLabel}>Save Location</Text>
            <View style={styles.directoryRow}>
              <View style={styles.directoryDisplay}>
                <Text style={styles.directoryText} numberOfLines={1}>
                  {settings.saveDirectory}
                </Text>
              </View>
              <TouchableOpacity style={styles.changeButton}>
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Preferences section */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(300)}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Text>🔔</Text>
            </View>
            <Text style={styles.cardTitle}>Preferences</Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchTitle}>
                  Auto-accept from paired devices
                </Text>
                <Text style={styles.switchDescription}>
                  Automatically accept file transfers from devices you've paired with
                </Text>
              </View>
              <Switch
                value={settings.autoAcceptFromPaired}
                onValueChange={(value) =>
                  onUpdate({ autoAcceptFromPaired: value })
                }
                trackColor={{ false: '#404040', true: '#ffffff' }}
                thumbColor={settings.autoAcceptFromPaired ? '#171717' : '#737373'}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchTitle}>Notifications</Text>
                <Text style={styles.switchDescription}>
                  Show notifications for incoming transfers
                </Text>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(value) =>
                  onUpdate({ notificationsEnabled: value })
                }
                trackColor={{ false: '#404040', true: '#ffffff' }}
                thumbColor={settings.notificationsEnabled ? '#171717' : '#737373'}
              />
            </View>
          </View>
        </Animated.View>

        {/* Paired Devices section */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(300)}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Text>🔗</Text>
            </View>
            <Text style={styles.cardTitle}>Paired Devices</Text>
          </View>

          {pairedDevices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📱</Text>
              <Text style={styles.emptyText}>No paired devices</Text>
              <Text style={styles.emptySubtext}>
                Devices you pair with will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.deviceList}>
              {pairedDevices.map((device) => (
                <View key={device.id} style={styles.deviceItem}>
                  <View style={styles.deviceInfo}>
                    <View style={styles.deviceIconContainer}>
                      <Text>{device.platform === 'android' ? '📱' : '💻'}</Text>
                    </View>
                    <View>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={styles.deviceDate}>
                        Paired {device.pairedAt ? new Date(device.pairedAt).toLocaleDateString() : 'Unknown'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => onUnpair?.(device.id)}
                    style={styles.forgetButton}
                  >
                    <Text>🗑️</Text>
                    <Text style={styles.forgetButtonText}>Forget</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* About section */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(300)}
          style={styles.aboutCard}
        >
          <View style={styles.aboutContent}>
            <Text style={styles.aboutTitle}>EasyShare</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

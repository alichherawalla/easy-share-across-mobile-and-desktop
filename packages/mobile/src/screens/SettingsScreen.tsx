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
import type { AppSettings } from '@easyshare/shared';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
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
});

export function SettingsScreen({ settings, onUpdate }: SettingsScreenProps) {
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

        {/* About section */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(300)}
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

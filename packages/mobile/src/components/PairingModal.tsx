import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { DiscoveredDevice, ConnectionState } from '@easyshare/shared';

interface PairingModalProps {
  visible: boolean;
  device: DiscoveredDevice | null;
  onClose: () => void;
  onPair: (passphrase: string) => void;
  connectionState: ConnectionState;
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modal: {
    backgroundColor: '#171717',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#737373',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#737373',
    fontSize: 20,
  },
  content: {
    padding: 24,
  },
  description: {
    color: '#a3a3a3',
    fontSize: 14,
    marginBottom: 16,
  },
  formContainer: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#737373',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#404040',
    color: '#ffffff',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
  },
  submitButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonActive: {
    backgroundColor: '#ffffff',
  },
  submitButtonInactive: {
    backgroundColor: '#262626',
  },
  submitButtonText: {
    fontWeight: '500',
  },
  submitButtonTextActive: {
    color: '#171717',
  },
  submitButtonTextInactive: {
    color: '#737373',
  },
  pairingText: {
    color: '#171717',
    fontWeight: '500',
    marginLeft: 8,
  },
});

export function PairingModal({
  visible,
  device,
  onClose,
  onPair,
  connectionState,
}: PairingModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const error = connectionState.error;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setIsSubmitting(false);
      setPassphrase('');
    }
  }, [visible]);

  const handleSubmit = () => {
    if (passphrase.trim() && !isSubmitting) {
      setIsSubmitting(true);
      onPair(passphrase.trim());
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContainer}>
                <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={styles.modal}
            >
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <Text>🔒</Text>
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>Pair Device</Text>
                    {device && (
                      <Text style={styles.headerSubtitle}>{device.name}</Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                <Text style={styles.description}>
                  Enter the same passphrase on both devices to establish a secure connection.
                </Text>

                <View style={styles.formContainer}>
                  <View>
                    <Text style={styles.inputLabel}>Passphrase</Text>
                    <TextInput
                      value={passphrase}
                      onChangeText={setPassphrase}
                      placeholder="Enter a shared passphrase"
                      placeholderTextColor="#737373"
                      editable={!isSubmitting}
                      autoFocus
                      style={styles.input}
                    />
                  </View>

                  {error && <Text style={styles.errorText}>{error}</Text>}

                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!passphrase.trim() || isSubmitting}
                    style={[
                      styles.submitButton,
                      passphrase.trim() && !isSubmitting
                        ? styles.submitButtonActive
                        : styles.submitButtonInactive,
                    ]}
                  >
                    {isSubmitting ? (
                      <>
                        <ActivityIndicator size="small" color="#171717" />
                        <Text style={styles.pairingText}>Pairing...</Text>
                      </>
                    ) : (
                      <Text
                        style={[
                          styles.submitButtonText,
                          passphrase.trim()
                            ? styles.submitButtonTextActive
                            : styles.submitButtonTextInactive,
                        ]}
                      >
                        Pair
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

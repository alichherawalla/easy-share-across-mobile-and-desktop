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
  isIncoming?: boolean;
}

type PairingStep = 'input' | 'connecting' | 'verifying' | 'establishing' | 'success' | 'error';

function getStepFromState(connectionState: ConnectionState, isSubmitting: boolean, isIncoming: boolean): PairingStep {
  if (connectionState.error) return 'error';
  if (connectionState.status === 'connected') return 'success';
  // For incoming requests, stay in input until user submits passphrase
  if (isIncoming && !isSubmitting) return 'input';
  if (connectionState.status === 'pairing') return 'verifying';
  if (connectionState.status === 'connecting') return 'connecting';
  if (isSubmitting) return isIncoming ? 'verifying' : 'connecting';
  return 'input';
}

const stepMessages: Record<PairingStep, { title: string; subtitle: string }> = {
  input: { title: 'Enter Passphrase', subtitle: 'Enter the same passphrase on both devices' },
  connecting: { title: 'Connecting...', subtitle: 'Establishing connection to device' },
  verifying: { title: 'Verifying...', subtitle: 'Checking passphrase match' },
  establishing: { title: 'Securing...', subtitle: 'Establishing encrypted connection' },
  success: { title: 'Connected!', subtitle: 'Devices paired successfully' },
  error: { title: 'Failed', subtitle: 'Could not complete pairing' },
};

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
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
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
  // Progress styles
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressIconBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  progressIconGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  progressIconRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  progressSubtitle: {
    fontSize: 14,
    color: '#737373',
  },
  stepContainer: {
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconPending: {
    backgroundColor: '#262626',
  },
  stepIconActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  stepIconComplete: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  stepIconError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  stepText: {
    fontSize: 14,
  },
  stepTextPending: {
    color: '#525252',
  },
  stepTextActive: {
    color: '#60a5fa',
  },
  stepTextComplete: {
    color: '#4ade80',
  },
  stepTextError: {
    color: '#f87171',
  },
  tryAgainButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#262626',
    alignItems: 'center',
  },
  tryAgainText: {
    color: '#a3a3a3',
    fontWeight: '500',
  },
  statusMessageContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(38, 38, 38, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(64, 64, 64, 0.5)',
  },
  statusMessageText: {
    color: '#d4d4d4',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

function StepIndicator({
  label,
  status,
}: {
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}) {
  const iconStyle = [
    styles.stepIcon,
    status === 'pending' && styles.stepIconPending,
    status === 'active' && styles.stepIconActive,
    status === 'complete' && styles.stepIconComplete,
    status === 'error' && styles.stepIconError,
  ];

  const textStyle = [
    styles.stepText,
    status === 'pending' && styles.stepTextPending,
    status === 'active' && styles.stepTextActive,
    status === 'complete' && styles.stepTextComplete,
    status === 'error' && styles.stepTextError,
  ];

  return (
    <View style={styles.stepRow}>
      <View style={iconStyle}>
        {status === 'complete' ? (
          <Text style={{ color: '#4ade80', fontSize: 12 }}>✓</Text>
        ) : status === 'active' ? (
          <ActivityIndicator size="small" color="#60a5fa" />
        ) : status === 'error' ? (
          <Text style={{ color: '#f87171', fontSize: 12 }}>✕</Text>
        ) : (
          <Text style={{ color: '#525252', fontSize: 12 }}>○</Text>
        )}
      </View>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

export function PairingModal({
  visible,
  device,
  onClose,
  onPair,
  connectionState,
  isIncoming = false,
}: PairingModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const error = connectionState.error;

  const currentStep = getStepFromState(connectionState, isSubmitting, isIncoming);
  const stepInfo = stepMessages[currentStep];

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

  const getStepStatus = (step: 'connect' | 'verify' | 'secure'): 'pending' | 'active' | 'complete' | 'error' => {
    if (step === 'connect') {
      if (currentStep === 'connecting') return 'active';
      if (['verifying', 'establishing', 'success'].includes(currentStep)) return 'complete';
      if (currentStep === 'error') return 'error';
      return 'pending';
    }
    if (step === 'verify') {
      if (currentStep === 'verifying') return 'active';
      if (['establishing', 'success'].includes(currentStep)) return 'complete';
      if (currentStep === 'error' && connectionState.status === 'pairing') return 'error';
      return 'pending';
    }
    if (step === 'secure') {
      if (currentStep === 'establishing') return 'active';
      if (currentStep === 'success') return 'complete';
      return 'pending';
    }
    return 'pending';
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
                    {/* Progress View - shown during pairing */}
                    {currentStep !== 'input' && (
                      <View style={styles.progressContainer}>
                        <View style={styles.progressHeader}>
                          <View
                            style={[
                              styles.progressIconContainer,
                              currentStep === 'error'
                                ? styles.progressIconRed
                                : currentStep === 'success'
                                ? styles.progressIconGreen
                                : styles.progressIconBlue,
                            ]}
                          >
                            {currentStep === 'error' ? (
                              <Text style={{ color: '#f87171', fontSize: 18 }}>✕</Text>
                            ) : currentStep === 'success' ? (
                              <Text style={{ color: '#4ade80', fontSize: 18 }}>✓</Text>
                            ) : (
                              <ActivityIndicator size="small" color="#60a5fa" />
                            )}
                          </View>
                          <View>
                            <Text style={styles.progressTitle}>{stepInfo.title}</Text>
                            <Text style={styles.progressSubtitle}>{stepInfo.subtitle}</Text>
                          </View>
                        </View>

                        {/* Verbose status message */}
                        {connectionState.statusMessage && (
                          <View style={styles.statusMessageContainer}>
                            <Text style={styles.statusMessageText}>
                              {connectionState.statusMessage}
                            </Text>
                          </View>
                        )}

                        <View style={styles.stepContainer}>
                          <StepIndicator label="Connect to device" status={getStepStatus('connect')} />
                          <StepIndicator label="Verify passphrase" status={getStepStatus('verify')} />
                          <StepIndicator label="Establish secure connection" status={getStepStatus('secure')} />
                        </View>

                        {error && (
                          <View style={[styles.errorContainer, { marginTop: 16 }]}>
                            <Text style={styles.errorText}>{error}</Text>
                          </View>
                        )}

                        {currentStep === 'error' && (
                          <TouchableOpacity
                            style={styles.tryAgainButton}
                            onPress={() => setIsSubmitting(false)}
                          >
                            <Text style={styles.tryAgainText}>Try Again</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Input Form - shown in input state */}
                    {currentStep === 'input' && (
                      <View style={styles.formContainer}>
                        <Text style={styles.description}>
                          Enter the same passphrase on both devices to establish a secure connection.
                        </Text>

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
                          <Text
                            style={[
                              styles.submitButtonText,
                              passphrase.trim()
                                ? styles.submitButtonTextActive
                                : styles.submitButtonTextInactive,
                            ]}
                          >
                            Start Pairing
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
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

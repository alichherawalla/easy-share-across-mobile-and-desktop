import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
// Document picker - may not be available without native rebuild
let DocumentPicker: any = null;
try {
  DocumentPicker = require('react-native-document-picker').default;
} catch (e) {
  // Module not available
}
import type { DeviceInfo, TransferProgress, TransferQueueItem, Transfer, FileTransfer } from '@easyshare/shared';
import { formatTransferSpeed, formatDuration } from '@easyshare/shared';
import { ProgressBar } from '../components/ProgressBar';

interface ConnectedScreenProps {
  device: DeviceInfo;
  onDisconnect: () => void;
  onSendText: (text: string) => void;
  onSendFile: (filePath: string, fileName?: string) => void;
  onSendFiles?: (files: Array<{ uri: string; name?: string }>) => void;
  currentProgress: TransferProgress | null;
  transfers: Transfer[];
  transferQueue?: TransferQueueItem[];
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  deviceCard: {
    marginBottom: 24,
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(23, 23, 23, 0.6)',
    borderWidth: 1,
    borderColor: '#262626',
  },
  deviceCardHeader: {
    flexDirection: 'column',
    gap: 16,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceIcon: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(38, 38, 38, 0.8)',
  },
  deviceIconText: {
    fontSize: 24,
  },
  deviceName: {
    fontSize: 20,
    fontWeight: '300',
    color: '#ffffff',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  statusText: {
    color: '#737373',
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(38, 38, 38, 0.6)',
    borderWidth: 1,
    borderColor: '#404040',
  },
  disconnectText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  progressCard: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(23, 23, 23, 0.6)',
    borderWidth: 1,
    borderColor: '#262626',
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
  formContainer: {
    gap: 16,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(23, 23, 23, 0.6)',
    borderWidth: 1,
    borderColor: '#262626',
    color: '#ffffff',
    minHeight: 100,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sendButtonActive: {
    backgroundColor: '#ffffff',
  },
  sendButtonInactive: {
    backgroundColor: '#262626',
  },
  sendButtonText: {
    fontWeight: '500',
  },
  sendButtonTextActive: {
    color: '#171717',
  },
  sendButtonTextInactive: {
    color: '#737373',
  },
  fileDropZone: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#262626',
  },
  fileDropContent: {
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    fontSize: 24,
  },
  fileDropText: {
    color: '#a3a3a3',
  },
  fileDropSubtext: {
    fontSize: 14,
    color: '#525252',
    marginTop: 4,
  },
  bottomPadding: {
    height: 100,
  },
  transferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(23, 23, 23, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(38, 38, 38, 0.5)',
    marginBottom: 8,
  },
  transferIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transferIconSend: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  transferIconReceive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  transferIconText: {
    fontSize: 14,
  },
  transferContent: {
    flex: 1,
  },
  transferText: {
    fontSize: 14,
    color: '#ffffff',
  },
  transferMeta: {
    fontSize: 12,
    color: '#737373',
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 14,
    color: '#22c55e',
  },
  activityContainer: {
    maxHeight: 200,
    overflow: 'hidden',
  },
  activityScroll: {
    maxHeight: 200,
  },
  emptyActivity: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(23, 23, 23, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(38, 38, 38, 0.5)',
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: 14,
    color: '#737373',
  },
  emptyActivitySubtext: {
    fontSize: 12,
    color: '#525252',
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#171717',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderIconText: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#737373',
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 20,
    color: '#737373',
  },
  modalBody: {
    padding: 16,
  },
  modalTextContent: {
    backgroundColor: 'rgba(38, 38, 38, 0.5)',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalTextValue: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  modalFileInfo: {
    marginBottom: 16,
  },
  modalFileLabel: {
    fontSize: 12,
    color: '#737373',
    marginBottom: 4,
  },
  modalFileValue: {
    fontSize: 14,
    color: '#ffffff',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#262626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  queueHeader: {
    fontSize: 11,
    fontWeight: '500',
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  queueItem: {
    paddingVertical: 6,
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  queueFileName: {
    fontSize: 13,
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  queueFileNamePending: {
    color: '#737373',
  },
  queueFileNameFailed: {
    color: '#f87171',
  },
  queueStatus: {
    fontSize: 12,
  },
  queueStatusCompleted: {
    color: '#4ade80',
  },
  queueStatusFailed: {
    color: '#f87171',
  },
  queueStatusActive: {
    color: '#60a5fa',
  },
  queueStatusPending: {
    color: '#525252',
  },
  queueProgressBg: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#262626',
    overflow: 'hidden',
  },
  queueProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#3b82f6',
  },
  queueProgressCompleteBg: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    overflow: 'hidden',
  },
  queueProgressCompleteFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#22c55e',
    width: '100%',
  },
});

export function ConnectedScreen({
  device,
  onDisconnect,
  onSendText,
  onSendFile,
  onSendFiles,
  currentProgress,
  transfers,
  transferQueue = [],
}: ConnectedScreenProps) {
  const [textInput, setTextInput] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  // Show recent transfers (all transfers for now)
  const sessionTransfers = transfers.slice(0, 10);

  const handleSendText = () => {
    if (textInput.trim()) {
      onSendText(textInput.trim());
      setTextInput('');
    }
  };

  const handleSelectFile = useCallback(async () => {
    if (!DocumentPicker) {
      Alert.alert(
        'Rebuild Required',
        'File picker requires rebuilding the app.\n\nRun:\ncd packages/mobile/android && ./gradlew assembleDebug',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        allowMultiSelection: true,
      });

      if (result.length > 0) {
        if (result.length === 1) {
          // Single file - use existing callback
          const file = result[0];
          if (file.uri) {
            onSendFile(file.uri, file.name || undefined);
          }
        } else if (onSendFiles) {
          // Multiple files - use batch callback
          const files = result
            .filter((file: any) => file.uri)
            .map((file: any) => ({ uri: file.uri, name: file.name || undefined }));
          onSendFiles(files);
        } else {
          // Fallback: send files one by one
          for (const file of result) {
            if (file.uri) {
              onSendFile(file.uri, file.name || undefined);
            }
          }
        }
      }
    } catch (err: any) {
      if (DocumentPicker.isCancel?.(err)) {
        return;
      }
      Alert.alert('Error', 'Failed to select file');
      console.error('Document picker error:', err);
    }
  }, [onSendFile, onSendFiles]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCopyToClipboard = useCallback(() => {
    if (selectedTransfer?.type === 'text' && selectedTransfer.content) {
      Alert.alert('Copy Text', 'Long-press on the text above to select and copy it.');
    }
  }, [selectedTransfer]);

  const closeModal = useCallback(() => {
    setSelectedTransfer(null);
  }, []);

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.deviceCard}>
        <View style={styles.deviceCardHeader}>
          <View style={styles.deviceInfoRow}>
            <View style={styles.deviceInfo}>
              <View style={styles.deviceIcon}>
                <Text style={styles.deviceIconText}>
                  {device.platform === 'android' ? '📱' : '💻'}
                </Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Connected</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={onDisconnect}
            style={styles.disconnectButton}
          >
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {transferQueue.length > 0 ? (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={styles.progressCard}
        >
          <Text style={styles.queueHeader}>
            Sending {transferQueue.filter((q) => q.status === 'completed').length}/{transferQueue.length} files
          </Text>
          {transferQueue.map((item) => (
            <View key={item.id} style={styles.queueItem}>
              <View style={styles.queueItemRow}>
                <Text
                  style={[
                    styles.queueFileName,
                    item.status === 'pending' && styles.queueFileNamePending,
                    item.status === 'failed' && styles.queueFileNameFailed,
                  ]}
                  numberOfLines={1}
                >
                  {item.fileName}
                </Text>
                <Text
                  style={[
                    styles.queueStatus,
                    item.status === 'completed' && styles.queueStatusCompleted,
                    item.status === 'failed' && styles.queueStatusFailed,
                    item.status === 'transferring' && styles.queueStatusActive,
                    item.status === 'pending' && styles.queueStatusPending,
                  ]}
                >
                  {item.status === 'completed' ? '✓' :
                   item.status === 'failed' ? '✗' :
                   item.status === 'transferring' ? `${item.progress}%` :
                   'Queued'}
                </Text>
              </View>
              {item.status === 'transferring' && (
                <View style={styles.queueProgressBg}>
                  <View style={[styles.queueProgressFill, { width: `${item.progress}%` }]} />
                </View>
              )}
              {item.status === 'completed' && (
                <View style={styles.queueProgressCompleteBg}>
                  <View style={styles.queueProgressCompleteFill} />
                </View>
              )}
            </View>
          ))}
        </Animated.View>
      ) : currentProgress ? (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={styles.progressCard}
        >
          <ProgressBar
            progress={currentProgress.percentage}
            label={currentProgress.currentFile || 'Transferring...'}
          />
        </Animated.View>
      ) : null}

      {/* Recent Activity */}
      <Animated.View
        entering={FadeInDown.delay(50).duration(300)}
        style={styles.section}
      >
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {sessionTransfers.length > 0 ? (
          <View style={styles.activityContainer}>
            <ScrollView
              style={styles.activityScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {sessionTransfers.map((transfer) => (
                <TouchableOpacity
                  key={transfer.id}
                  style={styles.transferItem}
                  onPress={() => setSelectedTransfer(transfer)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.transferIcon,
                      transfer.direction === 'send'
                        ? styles.transferIconSend
                        : styles.transferIconReceive,
                    ]}
                  >
                    <Text style={styles.transferIconText}>
                      {transfer.direction === 'send' ? '↑' : '↓'}
                    </Text>
                  </View>
                  <View style={styles.transferContent}>
                    <Text style={styles.transferText} numberOfLines={1}>
                      {transfer.type === 'text'
                        ? transfer.content?.slice(0, 50) +
                          (transfer.content && transfer.content.length > 50
                            ? '...'
                            : '')
                        : transfer.fileName}
                    </Text>
                    <Text style={styles.transferMeta}>
                      {transfer.type === 'text' ? 'Text' : 'File'} •{' '}
                      {formatTime(transfer.timestamp)}
                    </Text>
                  </View>
                  <Text style={styles.checkIcon}>✓</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyActivity}>
            <Text style={styles.emptyActivityText}>No activity yet</Text>
            <Text style={styles.emptyActivitySubtext}>
              Send text or files to see them here
            </Text>
          </View>
        )}
      </Animated.View>

  <Animated.View entering={FadeInDown.delay(200).duration(300)}>
        <Text style={styles.sectionTitle}>Send File</Text>

        <TouchableOpacity onPress={handleSelectFile} style={styles.fileDropZone}>
          <View style={styles.fileDropContent}>
            <Text style={styles.fileIcon}>📄</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.fileDropText}>Tap to select files</Text>
              <Text style={styles.fileDropSubtext}>
                Select one or multiple files to share
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(100).duration(300)}
        style={styles.section}
      >
        <Text style={styles.sectionTitle}>Send Text</Text>

        <View style={styles.formContainer}>
          <TextInput
            value={textInput}
            onChangeText={setTextInput}
            placeholder="Type a message to send..."
            placeholderTextColor="#525252"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={styles.textInput}
          />

          <TouchableOpacity
            onPress={handleSendText}
            disabled={!textInput.trim()}
            style={[
              styles.sendButton,
              textInput.trim()
                ? styles.sendButtonActive
                : styles.sendButtonInactive,
            ]}
          >
            <Text
              style={[
                styles.sendButtonText,
                textInput.trim()
                  ? styles.sendButtonTextActive
                  : styles.sendButtonTextInactive,
              ]}
            >
              Send Text
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={styles.bottomPadding} />

      {/* Transfer Detail Modal */}
      <Modal
        visible={selectedTransfer !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalHeaderIcon,
                    selectedTransfer?.direction === 'send'
                      ? styles.transferIconSend
                      : styles.transferIconReceive,
                  ]}
                >
                  <Text style={styles.modalHeaderIconText}>
                    {selectedTransfer?.direction === 'send' ? '↑' : '↓'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedTransfer?.type === 'text'
                      ? 'Text Message'
                      : selectedTransfer?.fileName}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedTransfer?.direction === 'send' ? 'Sent' : 'Received'} •{' '}
                    {selectedTransfer && formatTime(selectedTransfer.timestamp)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedTransfer?.type === 'text' ? (
                <>
                  <View style={styles.modalTextContent}>
                    <Text style={styles.modalTextValue} selectable>
                      {selectedTransfer.content}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopyToClipboard}
                  >
                    <Text style={styles.copyButtonText}>
                      📋 Copy instructions
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.modalFileInfo}>
                  <Text style={styles.modalFileLabel}>File name</Text>
                  <Text style={styles.modalFileValue}>{selectedTransfer?.fileName}</Text>
                  <Text style={[styles.modalFileLabel, { marginTop: 12 }]}>Size</Text>
                  <Text style={styles.modalFileValue}>
                    {((selectedTransfer?.fileSize || 0) / 1024).toFixed(1)} KB
                  </Text>
                  {(selectedTransfer as FileTransfer)?.speedBytesPerSec != null && (
                    <>
                      <Text style={[styles.modalFileLabel, { marginTop: 12 }]}>Speed</Text>
                      <Text style={styles.modalFileValue}>
                        {formatTransferSpeed((selectedTransfer as FileTransfer).speedBytesPerSec!)}
                        {' · '}
                        {formatDuration((selectedTransfer as FileTransfer).durationMs!)}
                      </Text>
                    </>
                  )}
                  {selectedTransfer?.direction === 'receive' && (selectedTransfer as any).filePath && (
                    <>
                      <Text style={[styles.modalFileLabel, { marginTop: 12 }]}>Saved to</Text>
                      <Text style={[styles.modalFileValue, { fontSize: 12 }]} selectable>
                        {(selectedTransfer as any).filePath}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

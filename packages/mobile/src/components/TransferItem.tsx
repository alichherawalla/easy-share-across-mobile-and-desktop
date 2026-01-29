import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Transfer, TextTransfer, FileTransfer } from '@easyshare/shared';
import { formatFileSize } from '@easyshare/shared';

interface TransferItemProps {
  transfer: Transfer;
  index: number;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(23, 23, 23, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(38, 38, 38, 0.5)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  iconContainerText: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  iconContainerFile: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  content: {
    flex: 1,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  directionIcon: {
    color: '#737373',
  },
  directionText: {
    fontSize: 14,
    color: '#a3a3a3',
  },
  contentText: {
    color: '#ffffff',
    fontSize: 14,
  },
  fileSizeText: {
    color: '#737373',
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 12,
    color: '#737373',
  },
  timeText: {
    fontSize: 12,
    color: '#525252',
  },
});

export function TransferItem({ transfer, index }: TransferItemProps) {
  const isText = transfer.type === 'text';
  const isSent = transfer.direction === 'send';

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 30).duration(200)}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={isText ? styles.iconContainerText : styles.iconContainerFile}>
          <Text>{isText ? '💬' : '📄'}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.directionRow}>
            <Text style={styles.directionIcon}>{isSent ? '↑' : '↓'}</Text>
            <Text style={styles.directionText}>
              {isSent ? 'Sent to' : 'Received from'} {transfer.deviceName}
            </Text>
          </View>

          {isText ? (
            <Text style={styles.contentText} numberOfLines={2}>
              {(transfer as TextTransfer).content}
            </Text>
          ) : (
            <Text style={styles.contentText}>
              {(transfer as FileTransfer).fileName}
              <Text style={styles.fileSizeText}>
                {' '}{formatFileSize((transfer as FileTransfer).fileSize)}
              </Text>
            </Text>
          )}
        </View>

        <View style={styles.timeContainer}>
          <Text style={styles.dateText}>{formatDate(transfer.timestamp)}</Text>
          <Text style={styles.timeText}>{formatTime(transfer.timestamp)}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { Transfer } from '@easyshare/shared';
import { TransferItem } from '../components/TransferItem';

interface HistoryScreenProps {
  transfers: Transfer[];
  onClear: () => void;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(38, 38, 38, 0.5)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 30,
    fontWeight: '300',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    color: '#737373',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#737373',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 30,
    marginBottom: 16,
  },
  emptyText: {
    color: '#737373',
    textAlign: 'center',
  },
  groupsContainer: {
    gap: 24,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#737373',
    marginBottom: 12,
  },
  transferList: {
    gap: 8,
  },
  bottomPadding: {
    height: 32,
  },
});

export function HistoryScreen({ transfers, onClear }: HistoryScreenProps) {
  const isEmpty = transfers.length === 0;

  const groupedTransfers = transfers.reduce((groups, transfer) => {
    const date = new Date(transfer.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transfer);
    return groups;
  }, {} as Record<string, Transfer[]>);

  const formatGroupDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Animated.View entering={FadeIn.duration(300)}>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>
              {isEmpty
                ? 'No transfers yet'
                : `${transfers.length} transfer${transfers.length !== 1 ? 's' : ''}`}
            </Text>
          </Animated.View>

          {!isEmpty && (
            <TouchableOpacity onPress={onClear} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {isEmpty ? (
          <Animated.View
            entering={FadeIn.delay(200).duration(300)}
            style={styles.emptyState}
          >
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>
              Your transfer history will appear here
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.groupsContainer}>
            {Object.entries(groupedTransfers).map(
              ([date, dateTransfers], groupIndex) => (
                <Animated.View
                  key={date}
                  entering={FadeInDown.delay(groupIndex * 100).duration(300)}
                >
                  <Text style={styles.groupTitle}>{formatGroupDate(date)}</Text>
                  <View style={styles.transferList}>
                    {dateTransfers.map((transfer, index) => (
                      <TransferItem
                        key={transfer.id}
                        transfer={transfer}
                        index={index}
                      />
                    ))}
                  </View>
                </Animated.View>
              )
            )}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

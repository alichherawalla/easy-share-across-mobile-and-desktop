import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

type ViewType = 'discovery' | 'connected' | 'history' | 'settings';

interface HeaderProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isConnected: boolean;
}

interface NavItem {
  id: ViewType;
  label: string;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(38, 38, 38, 0.5)',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButtonActive: {
    backgroundColor: 'rgba(38, 38, 38, 0.6)',
  },
  navText: {
    fontSize: 14,
    fontWeight: '500',
  },
  navTextActive: {
    color: '#ffffff',
  },
  navTextInactive: {
    color: '#737373',
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginLeft: 8,
  },
});

export function Header({ currentView, onViewChange, isConnected }: HeaderProps) {
  const navItems: NavItem[] = [
    { id: 'discovery', label: 'Devices' },
    ...(isConnected ? [{ id: 'connected' as ViewType, label: 'Connected' }] : []),
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.navRow}
      >
        {navItems.map((item) => {
          const isActive = currentView === item.id;

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onViewChange(item.id)}
              style={[styles.navButton, isActive && styles.navButtonActive]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.navText,
                  isActive ? styles.navTextActive : styles.navTextInactive,
                ]}
              >
                {item.label}
              </Text>
              {item.id === 'connected' && <View style={styles.connectedDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

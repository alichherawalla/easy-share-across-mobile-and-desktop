import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

interface ProgressBarProps {
  progress: number;
  label?: string;
  info?: string;
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelText: {
    color: '#a3a3a3',
    fontSize: 14,
  },
  percentText: {
    color: '#ffffff',
    fontWeight: '300',
  },
  track: {
    height: 6,
    backgroundColor: '#262626',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 999,
  },
  infoText: {
    color: '#737373',
    fontSize: 12,
  },
});

export function ProgressBar({ progress, label, info }: ProgressBarProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${progress}%`, { duration: 300 }),
    };
  });

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.labelText}>{label}</Text>
          <Text style={styles.percentText}>{progress}%</Text>
        </View>
      )}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, animatedStyle]} />
      </View>
      {info ? <Text style={styles.infoText}>{info}</Text> : null}
    </View>
  );
}

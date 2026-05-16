import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface DisasterAlertProps {
  type: 'FIRE' | 'FLOOD' | 'EARTHQUAKE';
  title: string;
  message: string;
}

export default function DisasterAlert({ type, title, message }: DisasterAlertProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Nabız (Pulse) animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  let backgroundColor = '#F59E0B'; // Default orange
  let icon = '⚠️';

  if (type === 'FIRE') {
    backgroundColor = '#DC2626'; // Red
    icon = '🔥';
  } else if (type === 'FLOOD') {
    backgroundColor = '#2563EB'; // Blue
    icon = '🌊';
  } else if (type === 'EARTHQUAKE') {
    backgroundColor = '#7C3AED'; // Purple
    icon = '🏚️';
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor, transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  iconContainer: {
    marginRight: 16,
  },
  icon: {
    fontSize: 32,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  message: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});

/**
 * Durum Çubuğu Bileşeni
 * Offline/online durumu ve pil seviyesini gösterir.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../config/constants';

interface StatusBannerProps {
  isOffline: boolean;
  batteryLevel: number;
}

const StatusBanner: React.FC<StatusBannerProps> = ({ isOffline, batteryLevel }) => {
  /** Pil seviyesine göre ikon */
  const getBatteryIcon = (): string => {
    if (batteryLevel > 75) return '🔋';
    if (batteryLevel > 40) return '🔋';
    if (batteryLevel > 15) return '🪫';
    return '🪫';
  };

  return (
    <View style={styles.container}>
      {/* Bağlantı durumu */}
      <View style={styles.statusItem}>
        <View style={[styles.dot, { backgroundColor: isOffline ? COLORS.danger : COLORS.success }]} />
        <Text style={styles.statusText}>{isOffline ? 'Çevrimdışı' : 'Çevrimiçi'}</Text>
      </View>

      {/* Pil durumu */}
      <View style={styles.statusItem}>
        <Text style={styles.batteryIcon}>{getBatteryIcon()}</Text>
        <Text style={[styles.statusText, batteryLevel <= 20 && { color: COLORS.danger }]}>
          %{batteryLevel}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 55, paddingBottom: 8,
  },
  statusItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, color: COLORS.grey },
  batteryIcon: { fontSize: 14, marginRight: 4 },
});

export default StatusBanner;

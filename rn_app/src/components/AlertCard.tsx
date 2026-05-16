/**
 * Uyarı Kartı Bileşeni
 * Afet uyarılarını ana sayfada göstermek için kullanılır.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DisasterAlert } from '../types';
import { COLORS } from '../config/constants';

interface AlertCardProps {
  alert: DisasterAlert;
  onPress: () => void;
}

/** Afet türüne göre ikon döndürür */
const getDisasterIcon = (type: string): string => {
  const icons: Record<string, string> = {
    earthquake: '🌍', flood: '🌊', fire: '🔥', storm: '🌪️', landslide: '⛰️',
  };
  return icons[type] || '⚠️';
};

/** Aciliyet seviyesine göre renk döndürür */
const getSeverityColor = (severity: string): string => {
  const colors: Record<string, string> = {
    low: COLORS.info, medium: COLORS.warning, high: COLORS.secondary, critical: COLORS.danger,
  };
  return colors[severity] || COLORS.grey;
};

const AlertCard: React.FC<AlertCardProps> = ({ alert, onPress }) => {
  const borderColor = getSeverityColor(alert.severity);

  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: borderColor }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.icon}>{getDisasterIcon(alert.type)}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{alert.title}</Text>
          <Text style={styles.source}>{alert.source}</Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: `${borderColor}22` }]}>
          <Text style={[styles.severityText, { color: borderColor }]}>
            {alert.severity === 'critical' ? 'KRİTİK' : alert.severity === 'high' ? 'YÜKSEK' : alert.severity === 'medium' ? 'ORTA' : 'DÜŞÜK'}
          </Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>{alert.description}</Text>
      <Text style={styles.time}>{new Date(alert.created_at).toLocaleString('tr-TR')}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16,
    marginBottom: 10, borderLeftWidth: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  icon: { fontSize: 24, marginRight: 10 },
  headerText: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  source: { fontSize: 11, color: COLORS.grey, marginTop: 2 },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  severityText: { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 13, color: COLORS.grey, lineHeight: 18, marginBottom: 6 },
  time: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
});

export default AlertCard;

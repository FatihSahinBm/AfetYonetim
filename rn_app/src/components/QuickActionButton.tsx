/**
 * Hızlı Erişim Butonu Bileşeni
 * Ana sayfadaki kısa yol butonları için kullanılır.
 */

import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../config/constants';

interface QuickActionButtonProps {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({ icon, label, color, onPress }) => {
  return (
    <TouchableOpacity style={[styles.button, { borderColor: `${color}44` }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flex: 1, alignItems: 'center', paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    borderWidth: 1,
  },
  icon: { fontSize: 26, marginBottom: 6 },
  label: { fontSize: 11, color: COLORS.white, fontWeight: '600' },
});

export default QuickActionButton;

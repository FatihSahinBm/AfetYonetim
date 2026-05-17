// Fallback for non-web platforms (mobile)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TrapMap({ reports }: { reports: any[] }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🗺️ Harita yalnızca web tarayıcısında görüntülenir.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: '#64748B', fontSize: 14 },
});

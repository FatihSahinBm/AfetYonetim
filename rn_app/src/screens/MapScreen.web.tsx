import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MapScreen() {
  return (
    <View style={styles.loaderContainer}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#3B82F6', marginBottom: 10 }}>Harita Özelliği</Text>
      <Text style={{ textAlign: 'center', paddingHorizontal: 20, color: '#64748B' }}>
        Harita ve Navigasyon sistemi sadece iOS ve Android cihazlarda (mobil) çalışmaktadır. Lütfen telefonunuzdan test ediniz.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC'
  }
});

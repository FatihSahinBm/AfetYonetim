import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

export default function InfoScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.headerText}>Deprem Çantası Hazırlığı</Text>
        <View style={styles.card}>
          <Text style={styles.itemText}>• Su (Kişi başı en az 3 gün yetecek kadar)</Text>
          <Text style={styles.itemText}>• Bozulmayan gıdalar (Konserve, bisküvi vb.)</Text>
          <Text style={styles.itemText}>• İlk yardım çantası ve sürekli kullanılan ilaçlar</Text>
          <Text style={styles.itemText}>• Pilli radyo ve yedek piller</Text>
          <Text style={styles.itemText}>• El feneri ve yedek piller</Text>
          <Text style={styles.itemText}>• Düdük</Text>
          <Text style={styles.itemText}>• Nakit para</Text>
          <Text style={styles.itemText}>• Önemli evrakların fotokopileri</Text>
          <Text style={styles.itemText}>• Çok amaçlı çakı</Text>
          <Text style={styles.itemText}>• Battaniye veya uyku tulumu</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.headerText}>Temel İlk Yardım</Text>
        <View style={styles.card}>
          <Text style={styles.subHeaderText}>Kanamalar</Text>
          <Text style={styles.paragraphText}>Temiz bir bezle yara üzerine doğrudan baskı uygulayın. Kanama durana kadar baskıyı sürdürün. Kanayan bölgeyi kalp seviyesinden yukarıda tutmaya çalışın.</Text>
          
          <Text style={styles.subHeaderText}>Kırık ve Çıkıklar</Text>
          <Text style={styles.paragraphText}>Yaralı bölgeyi hareket ettirmeyin. Sert bir cisim (tahta parçası, kalın karton) ile sabitleyin ve hemen tıbbi yardım çağırın.</Text>

          <Text style={styles.subHeaderText}>Yanıklar</Text>
          <Text style={styles.paragraphText}>Yanan bölgeyi en az 10 dakika boyunca akan serin (buzlu değil) su altında tutun. Yanık üzerine krem veya yoğurt gibi şeyler sürmeyin.</Text>

          <Text style={styles.subHeaderText}>Şok Durumu</Text>
          <Text style={styles.paragraphText}>Hastayı sırt üstü yatırın ve ayaklarını 30 cm kadar yukarı kaldırın. Vücut ısısını korumak için üzerini örtün ve sakinleşmesini sağlayın.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  section: {
    padding: 16,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  itemText: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 8,
    lineHeight: 24,
  },
  subHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginTop: 12,
    marginBottom: 4,
  },
  paragraphText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 12,
  },
});

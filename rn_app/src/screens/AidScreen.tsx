import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { getDb } from '../services/db';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AidRequest = {
  id: string;
  user_id: string;
  full_name: string;
  type: 'NEED' | 'DONATION';
  category: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved';
  helper_id: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

export default function AidScreen() {
  const [activeTab, setActiveTab] = useState<'LIST' | 'MY_REQUESTS'>('LIST');
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myAidIds, setMyAidIds] = useState<Set<string>>(new Set());

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [reqType, setReqType] = useState<'NEED' | 'DONATION'>('NEED');
  const [reqCategory, setReqCategory] = useState('SU');
  const [reqDesc, setReqDesc] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    try {
      const stored = await AsyncStorage.getItem('my_aid_ids');
      if (stored) setMyAidIds(new Set(JSON.parse(stored)));
    } catch (e) { }

    // Gerçek bir senaryoda önce Supabase'den çekilir, sonra SQLite'a yazılır.
    // Şimdilik test amaçlı sadece SQLite'dan çekelim veya Supabase'den çekelim:
    try {
      const { data, error } = await supabase
        .from('aid_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRequests(data as AidRequest[]);
      }
    } catch (err) {
      console.log('Offline mode active for aid requests');
      // Çevrimdışıysak SQLite'dan okuma yapılabilir.
    }

    setLoading(false);
  };

  const createRequest = async () => {
    if (!reqDesc.trim()) {
      Alert.alert('Hata', 'Lütfen bir açıklama girin.');
      return;
    }

    let lat = null;
    let lng = null;

    try {
      const loc = await Location.getLastKnownPositionAsync({});
      if (loc) {
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch (e) { }

    const newReq = {
      user_id: currentUser?.id,
      full_name: currentUser?.email?.split('@')[0] || 'Kullanıcı',
      type: reqType,
      category: reqCategory,
      description: reqDesc,
      status: 'pending',
      latitude: lat,
      longitude: lng,
    };

    setLoading(true);
    const { data, error } = await supabase.from('aid_requests').insert([newReq]).select().single();

    if (error) {
      Alert.alert('Hata', 'İhtiyaç oluşturulamadı.');
    } else {
      Alert.alert('Başarılı', 'Kaydınız oluşturuldu.');
      setModalVisible(false);
      setReqDesc('');

      if (data) {
        const newSet = new Set(myAidIds);
        newSet.add(data.id);
        setMyAidIds(newSet);
        await AsyncStorage.setItem('my_aid_ids', JSON.stringify(Array.from(newSet)));
      }

      loadData();
    }
    setLoading(false);
  };

  const takeJob = async (reqId: string) => {
    if (!currentUser) return;
    setLoading(true);
    const { error } = await supabase
      .from('aid_requests')
      .update({ status: 'in_progress', helper_id: currentUser.id })
      .eq('id', reqId);

    if (error) {
      Alert.alert('Hata', 'Grev alınamadı.');
    } else {
      Alert.alert('Başarılı', 'Bu talebin lojistiğini üstlendiniz! Lütfen haritadan kişiye ulaşın.');
      loadData();
    }
    setLoading(false);
  };

  const markResolved = async (reqId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('aid_requests')
      .update({ status: 'resolved' })
      .eq('id', reqId);
    if (!error) loadData();
    setLoading(false);
  };

  const deleteRequest = (reqId: string) => {
    Alert.alert(
      'Talebi Sil',
      'Bu talebinizi kalıcı olarak silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase.from('aid_requests').delete().eq('id', reqId);
            if (!error) {
              Alert.alert('Silindi', 'Talebiniz başarıyla silindi.');
              loadData();
            } else {
              Alert.alert('Hata', 'Silme işlemi başarısız oldu: ' + error.message);
            }
            setLoading(false);
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: AidRequest }) => {
    const isMine = (currentUser && item.user_id === currentUser.id) || myAidIds.has(item.id);
    const iAmHelper = item.helper_id === currentUser?.id;

    if (activeTab === 'MY_REQUESTS' && !isMine && !iAmHelper) return null;

    let statusColor = '#EAB308'; // Bekliyor
    let statusText = 'Bekliyor';
    if (item.status === 'in_progress') {
      statusColor = '#3B82F6';
      statusText = 'Yolda / Üstlenildi';
    } else if (item.status === 'resolved') {
      statusColor = '#10B981';
      statusText = 'Tamamlandı';
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: item.type === 'NEED' ? '#EF4444' : '#10B981' }]}>
            <Text style={styles.typeText}>{item.type === 'NEED' ? 'İHTİYAÇ' : 'BAĞIŞ'}</Text>
          </View>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>

        <Text style={styles.categoryTitle}>{item.category} Talebi</Text>
        <Text style={styles.descText}>{item.description}</Text>
        <Text style={styles.authorText}>Kimden: {item.full_name}</Text>

        {/* Aksiyon Butonları */}
        {item.status === 'pending' && !isMine && item.type === 'NEED' && (
          <TouchableOpacity style={styles.takeJobBtn} onPress={() => takeJob(item.id)}>
            <Text style={styles.takeJobBtnText}>Ben Götürüyorum (Üstlen)</Text>
          </TouchableOpacity>
        )}

        {item.status === 'pending' && !isMine && item.type === 'DONATION' && (
          <TouchableOpacity style={[styles.takeJobBtn, { backgroundColor: '#10B981' }]} onPress={() => takeJob(item.id)}>
            <Text style={styles.takeJobBtnText}>Bana Lazım (Talep Et)</Text>
          </TouchableOpacity>
        )}

        {(isMine || iAmHelper) && item.status === 'in_progress' && (
          <TouchableOpacity style={styles.resolveBtn} onPress={() => markResolved(item.id)}>
            <Text style={styles.resolveBtnText}>İşlemi Tamamla</Text>
          </TouchableOpacity>
        )}

        {/* Sil Butonu (Eğer talep benimse) */}
        {isMine && (
          <TouchableOpacity style={[styles.takeJobBtn, { backgroundColor: '#EF4444', marginTop: item.status === 'in_progress' ? 8 : 0 }]} onPress={() => deleteRequest(item.id)}>
            <Text style={styles.takeJobBtnText}>🗑️ Talebi Sil</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'LIST' && styles.activeTab]} onPress={() => setActiveTab('LIST')}>
          <Text style={[styles.tabText, activeTab === 'LIST' && styles.activeTabText]}>Tüm İhtiyaçlar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'MY_REQUESTS' && styles.activeTab]} onPress={() => setActiveTab('MY_REQUESTS')}>
          <Text style={[styles.tabText, activeTab === 'MY_REQUESTS' && styles.activeTabText]}>Taleplerim & Görevlerim</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz bir talep bulunmuyor.</Text>}
        />
      )}

      {/* YENİ TALEP OLUŞTUR BUTONU */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* YENİ TALEP MODALI */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni İlan Oluştur</Text>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.typeBtn, reqType === 'NEED' && { backgroundColor: '#EF4444' }]} onPress={() => setReqType('NEED')}>
                <Text style={styles.typeBtnText}>İhtiyacım Var</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, reqType === 'DONATION' && { backgroundColor: '#10B981' }]} onPress={() => setReqType('DONATION')}>
                <Text style={styles.typeBtnText}>Yardım Edebilirim</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Kategori</Text>
            <View style={styles.rowWrap}>
              {['SU', 'GIDA', 'CADIR', 'ILAC', 'DIGER'].map(c => (
                <TouchableOpacity key={c} style={[styles.catBtn, reqCategory === c && styles.catBtnActive]} onPress={() => setReqCategory(c)}>
                  <Text style={[styles.catBtnText, reqCategory === c && { color: '#FFF' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Açıklama</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: 2 koli suya ihtiyacımız var..."
              multiline
              value={reqDesc}
              onChangeText={setReqDesc}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={createRequest}>
                <Text style={styles.saveBtnText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFF', elevation: 2 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#3B82F6' },
  tabText: { color: '#64748B', fontWeight: 'bold' },
  activeTabText: { color: '#3B82F6' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 16 },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 50 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  typeText: { color: '#FFF', fontWeight: 'bold', fontSize: 10 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  categoryTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 6 },
  descText: { fontSize: 14, color: '#475569', marginBottom: 12 },
  authorText: { fontSize: 12, color: '#94A3B8', marginBottom: 12 },
  takeJobBtn: { backgroundColor: '#3B82F6', padding: 12, borderRadius: 8, alignItems: 'center' },
  takeJobBtnText: { color: '#FFF', fontWeight: 'bold' },
  resolveBtn: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center' },
  resolveBtnText: { color: '#FFF', fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#3B82F6', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabIcon: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginTop: -4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#1E293B' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: { flex: 1, backgroundColor: '#E2E8F0', padding: 12, borderRadius: 8, alignItems: 'center' },
  typeBtnText: { color: '#FFF', fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  catBtnActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  catBtnText: { color: '#64748B', fontSize: 12, fontWeight: 'bold' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: 12, borderRadius: 8 },
  cancelBtnText: { color: '#64748B', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#3B82F6', padding: 12, borderRadius: 8 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' }
});

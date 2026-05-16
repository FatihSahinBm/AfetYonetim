import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../services/supabase';
import { cacheHouseholdMembers, getCachedHouseholdMembers } from '../services/db';
import { checkInternetConnection } from '../services/syncService';

export default function FamilyScreen() {
  const [members, setMembers] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(user);
        loadData(user.id);
      }
    });
  }, []);

  const loadData = async (userId: string) => {
    setLoading(true);
    const online = await checkInternetConnection();
    setIsOnline(online);

    if (!online) {
      // Çevrimdışı modda yerel SQLite veritabanından getir
      const cached = await getCachedHouseholdMembers();
      setMembers(cached);
      setLoading(false);
      return;
    }

    try {
      // Çevrimiçi Mod
      // 1. Kullanıcının mevcut hanesi var mı kontrol et, yoksa "Benim Hanem" oluştur
      const { data: myHouseholds } = await supabase
        .from('household_members')
        .select('household_id, status')
        .eq('user_id', userId);

      let primaryHouseholdId = null;

      if (!myHouseholds || myHouseholds.length === 0) {
        const { data: newHouse } = await supabase.from('households').insert({ name: 'Benim Hanem' }).select().single();
        if (newHouse) {
          await supabase.from('household_members').insert({
            household_id: newHouse.id,
            user_id: userId,
            role: 'admin',
            status: 'accepted'
          });
          primaryHouseholdId = newHouse.id;
        }
      } else {
        const accepted = myHouseholds.find((h: any) => h.status === 'accepted');
        if (accepted) primaryHouseholdId = accepted.household_id;
      }

      // 2. Bana Gelen Bekleyen Davetleri (Handshake) getir
      const { data: invites } = await supabase
        .from('household_members')
        .select(`
          id, household_id, role,
          households:household_id (name)
        `)
        .eq('user_id', userId)
        .eq('status', 'pending');
      
      setPendingInvites(invites || []);

      // 3. Hanemdeki kabul edilmiş (accepted) üyeleri getir
      if (!primaryHouseholdId) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const { data: allMembers } = await supabase
        .from('household_members')
        .select(`
          id, user_id, role, status, 
          profiles:user_id (email, full_name, last_active_at)
        `)
        .eq('household_id', primaryHouseholdId)
        .eq('status', 'accepted');

      if (!allMembers) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const enhancedMembers = [];
      for (const m of allMembers) {
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        if (!profile) continue;

        let statusColorText = '⚪ Bilinmiyor';
        let isZombie = false;
        let lastReportTime = 'Kayıt Yok';

        // Zombi kontrolü
        const lastDate = new Date(profile.last_active_at);
        const hoursPassed = (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60);
        if (hoursPassed > 48) {
          isZombie = true;
          statusColorText = '⚪ Bilinmiyor (Zombi)';
        }

        // Son acil durum raporunu getir (Trafik Lambası Mantığı)
        const { data: reportData } = await supabase
          .from('emergency_reports')
          .select('status_type, created_at')
          .eq('user_id', m.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (reportData) {
           lastReportTime = new Date(reportData.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
           if (reportData.status_type === 'SAFE') {
              statusColorText = '🟢 Güvende';
           } else if (reportData.status_type === 'TRAPPED') {
              statusColorText = '🔴 Tehlikede / Yardım Bekliyor';
           }
        }

        enhancedMembers.push({
          id: m.id,
          household_id: primaryHouseholdId,
          user_id: m.user_id,
          email: profile.email,
          full_name: profile.full_name || 'İsimsiz',
          role: m.role,
          status: 'accepted',
          last_active_at: profile.last_active_at,
          last_report_status: statusColorText,
          last_report_time: lastReportTime
        });
      }

      setMembers(enhancedMembers);
      
      // Çevrimdışı (Offline-First) stratejisi için verileri SQLite'a kaydet
      await cacheHouseholdMembers(enhancedMembers);

    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setLoading(true);
    await supabase.from('household_members').update({ status: 'accepted' }).eq('id', inviteId);
    await loadData(currentUser.id);
  };

  const inviteMember = async () => {
    if (!newEmail || !currentUser) return;
    setLoading(true);

    // 1. Admin olduğum haneyi bul
    const { data: myHouseholds } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', currentUser.id)
      .eq('status', 'accepted')
      .limit(1)
      .single();

    if (!myHouseholds) {
      Alert.alert('Hata', 'Hane bilginiz bulunamadı.');
      setLoading(false);
      return;
    }

    // 2. Davet edilecek e-posta sistemde var mı bul
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newEmail.toLowerCase())
      .single();

    if (!targetProfile) {
      Alert.alert('Hata', 'Bu e-posta adresine sahip bir kullanıcı bulunamadı. Lütfen önce uygulamaya kayıt olsun.');
      setLoading(false);
      return;
    }

    if (targetProfile.id === currentUser.id) {
      Alert.alert('Hata', 'Kendinizi davet edemezsiniz.');
      setLoading(false);
      return;
    }

    // 3. Daveti (pending state) yolla
    const { error } = await supabase.from('household_members').insert({
      household_id: myHouseholds.household_id,
      user_id: targetProfile.id,
      role: 'member',
      status: 'pending' // Çift Taraflı Onay Sistemi
    });

    if (error) {
      Alert.alert('Hata', 'Davet gönderilemedi. Zaten hanenizde veya davet edilmiş olabilir.');
    } else {
      Alert.alert('Başarılı', 'Kullanıcıya davet gönderildi. Onayladığında hanenizde görünecektir.');
      setNewEmail('');
    }
    setLoading(false);
  };

  const renderMember = ({ item }: { item: any }) => {
    let bgColor = '#F1F5F9';
    let borderColor = '#E2E8F0';
    
    // Trafik Lambası UI renk kodlaması
    if (item.last_report_status.includes('🟢')) {
      bgColor = '#ECFDF5';
      borderColor = '#10B981';
    } else if (item.last_report_status.includes('🔴')) {
      bgColor = '#FEF2F2';
      borderColor = '#EF4444';
    } else if (item.last_report_status.includes('⚪')) {
      bgColor = '#F8FAFC';
      borderColor = '#94A3B8';
    }

    return (
      <View style={[styles.memberCard, { backgroundColor: bgColor, borderColor, borderWidth: 1 }]}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberEmail}>{item.email}</Text>
          {item.user_id === currentUser?.id && <Text style={styles.youBadge}>(Sen)</Text>}
        </View>
        <Text style={styles.statusLargeText}>{item.last_report_status}</Text>
        <Text style={styles.lastActive}>Son Durum Bildirimi: {item.last_report_time}</Text>
      </View>
    );
  };

  const renderInvite = ({ item }: { item: any }) => {
    // Array gelirse güvenliği için ilk elemanı al
    const hName = Array.isArray(item.households) ? item.households[0]?.name : item.households?.name;
    return (
      <View style={styles.inviteCard}>
        <Text style={styles.inviteText}><Text style={{fontWeight: 'bold'}}>{hName || 'Bir Hane'}</Text> sizi davet ediyor.</Text>
        <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptInvite(item.id)}>
          <Text style={styles.acceptButtonText}>Kabul Et</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>🔴 Çevrimdışı Mod. Son bilinen hane verileri (Önbellek) gösteriliyor.</Text>
        </View>
      )}

      {/* Gelen Davetler (Eğer varsa) */}
      {isOnline && pendingInvites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bekleyen Davetler ({pendingInvites.length})</Text>
          <FlatList
            data={pendingInvites}
            keyExtractor={(item) => item.id}
            renderItem={renderInvite}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Davet Gönderme Formu (Sadece Online iken) */}
      {isOnline && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Haneye Birini Davet Et</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Davet edilecek e-posta"
              keyboardType="email-address"
              autoCapitalize="none"
              value={newEmail}
              onChangeText={setNewEmail}
            />
            <TouchableOpacity style={styles.addButton} onPress={inviteMember}>
              <Text style={styles.addButtonText}>Gönder</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Kişi e-postanız üzerinden bildirim alır ve onayladığında verilerini görebilirsiniz. (Mahremiyet Koruması)</Text>
        </View>
      )}

      {/* Kriz Merkezi / Hane Üyeleri */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hane Durum Merkezi (Trafik Lambası)</Text>
        {loading && members.length === 0 ? (
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={renderMember}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>Hanenizde kimse yok.</Text>}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    padding: 16,
  },
  offlineBanner: {
    backgroundColor: '#EF4444',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  offlineText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 16,
  },
  inviteCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 8,
  },
  inviteText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberEmail: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  youBadge: {
    marginLeft: 8,
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  statusLargeText: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  lastActive: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
    fontStyle: 'italic'
  },
});

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Vibration } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { cacheHouseholdMembers, getCachedHouseholdMembers } from '../services/db';
import { checkInternetConnection } from '../services/syncService';

export default function FamilyScreen() {
  const [members, setMembers] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [myHouseholdCode, setMyHouseholdCode] = useState<string | null>(null);
  const membersRef = useRef<any[]>([]);
  const navigation = useNavigation<any>();

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        loadData(session.user);
      }
    });
  }, []);

  // Gerçek Zamanlı (Realtime) Güncellemeleri Dinle
  useEffect(() => {
    if (!currentUser) return;

    const channelName = `family_updates_${currentUser.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_members' },
        () => {
          // Aileye biri katıldığında veya ayrıldığında verileri yenile
          console.log('[Realtime] household_members değişti, veriler güncelleniyor');
          loadData(currentUser);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergency_reports' },
        (payload: any) => {
          // Aileden birinin sağlık/güvenlik durumu değiştiğinde yenile
          console.log('[Realtime] emergency_reports değişti, veriler güncelleniyor');
          loadData(currentUser);

          if (payload.eventType === 'INSERT' && payload.new?.status_type === 'TRAPPED') {
            const trappedUserId = payload.new.user_id;
            const isFamilyMember = membersRef.current.some(m => m.user_id === trappedUserId && m.user_id !== currentUser.id);
            
            if (isFamilyMember) {
              const memberObj = membersRef.current.find(m => m.user_id === trappedUserId);
              Vibration.vibrate([1000, 500, 1000, 500, 1000]);
              Alert.alert('ACİL DURUM!', `Aile üyeniz (${memberObj?.full_name || 'Bilinmiyor'}) az önce MAHSUR KALDIĞINI bildirdi! Lütfen hemen konumunu kontrol edin.`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const loadData = async (userObj: any) => {
    setLoading(true);
    const userId = userObj.id;
    const online = await checkInternetConnection();
    setIsOnline(online);

    if (!online) {
      const cached = await getCachedHouseholdMembers();
      setMembers(cached);
      setLoading(false);
      return;
    }

    try {
      // Güvenlik: Kullanıcının profil kaydını garantiye al
      await supabase.from('profiles').upsert({
        id: userObj.id,
        email: userObj.email,
        last_active_at: new Date().toISOString()
      }, { onConflict: 'id' });

      // 1. Kullanıcının mevcut hanesi var mı kontrol et
      const { data: myHouseholds, error: hError } = await supabase
        .from('household_members')
        .select(`
          household_id, 
          status,
          households:household_id (name)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .limit(1);

      if (hError) {
         console.log("Hane fetch hatası:", hError);
      }

      let primaryHouseholdId = null;

      if (myHouseholds && myHouseholds.length > 0) {
        const firstHousehold = myHouseholds[0];
        primaryHouseholdId = firstHousehold.household_id;
        const hName = Array.isArray(firstHousehold.households) ? (firstHousehold.households[0] as any)?.name : (firstHousehold.households as any)?.name;
        if (hName && hName.startsWith('Aile-')) {
          setMyHouseholdCode(hName.replace('Aile-', ''));
        }
      } else {
        setMyHouseholdCode(null);
        setMembers([]);
        setLoading(false);
        return;
      }

      // 2. Hanemdeki kabul edilmiş (accepted) üyeleri getir
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
        let lastReportTime = 'Kayıt Yok';

        // Zombi kontrolü
        const lastDate = new Date(profile.last_active_at);
        const hoursPassed = (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60);
        if (hoursPassed > 48) {
          statusColorText = '⚪ Bilinmiyor (Zombi)';
        }

        // Son acil durum raporunu getir (Trafik Lambası Mantığı)
        const { data: reportData } = await supabase
          .from('emergency_reports')
          .select('status_type, created_at, lat, lon')
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
          last_report_time: lastReportTime,
          lat: reportData?.lat || null,
          lon: reportData?.lon || null
        });
      }

      setMembers(enhancedMembers);
      await cacheHouseholdMembers(enhancedMembers);

    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const createFamily = async () => {
    console.log('[createFamily] Başladı');
    setLoading(true);
    try {
      let activeUser = currentUser;
      if (!activeUser) {
        console.log('[createFamily] activeUser yok, session çekiliyor');
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          console.log('[createFamily] Session alındı');
          setCurrentUser(data.session.user);
          activeUser = data.session.user;
        } else {
          console.log('[createFamily] Session bulunamadı');
          Alert.alert('Oturum Hatası', 'Kullanıcı oturumunuz doğrulanamadı. Lütfen giriş ekranına dönüp tekrar giriş yapın.');
          setLoading(false);
          return;
        }
      }

      if (!isOnline) {
        console.log('[createFamily] Çevrimdışı, işlem iptal');
        Alert.alert('Çevrimdışı', 'Aile oluşturmak için internet bağlantısı gereklidir.');
        setLoading(false);
        return;
      }
      
      console.log('[createFamily] ID ve Kod üretiliyor');
      // 6 haneli eşsiz kod üret (Sunucuda da UNIQUE kontrolü yapacağız)
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const generatedHouseholdId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      console.log('[createFamily] households tablosuna ekleniyor:', { generatedHouseholdId, code });
      const { data: houseData, error: houseError } = await supabase.from('households').insert({ 
        id: generatedHouseholdId, 
        name: `Aile-${code}` 
      });
      console.log('[createFamily] households tablosuna eklendi, hata durumu:', houseError);

      if (!houseError) {
        console.log('[createFamily] household_members tablosuna ekleniyor:', activeUser.id);
        const { data: memberData, error: memberError } = await supabase.from('household_members').insert({
          household_id: generatedHouseholdId,
          user_id: activeUser.id,
          role: 'admin',
          status: 'accepted'
        });
        console.log('[createFamily] household_members tablosuna eklendi, hata durumu:', memberError);
        
        if (memberError) {
           Alert.alert('Hata', 'Aile oluşturuldu ancak sizi eklerken bir sorun oluştu.');
        } else {
           console.log('[createFamily] Başarılı, UI güncelleniyor ve loadData çağrılıyor');
           setMyHouseholdCode(code);
           await loadData(activeUser);
           console.log('[createFamily] loadData tamamlandı');
        }
      } else {
        console.log('[createFamily] households insert hatası:', houseError);
        Alert.alert('Hata', 'Aile oluşturulamadı: ' + houseError.message);
      }
    } catch (e: any) {
      console.log('[createFamily] CATCH BLOGU HATASI:', e);
      Alert.alert('Hata', 'İşlem sırasında beklenmeyen bir sorun oluştu: ' + (e?.message || 'Bağlantı kopukluğu'));
    } finally {
      console.log('[createFamily] FINALLY blogu, loading false yapılıyor');
      setLoading(false);
    }
  };

  const joinFamily = async () => {
    if (!joinCode) return;
    
    setLoading(true);
    try {
      let activeUser = currentUser;
      if (!activeUser) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          setCurrentUser(data.session.user);
          activeUser = data.session.user;
        } else {
          Alert.alert('Oturum Hatası', 'Kullanıcı oturumunuz bulunamadı.');
          setLoading(false);
          return;
        }
      }

      if (!isOnline) {
        Alert.alert('Çevrimdışı', 'Aileye katılmak için internet bağlantısı gereklidir.');
        setLoading(false);
        return;
      }

      const codeToSearch = `Aile-${joinCode.toUpperCase().trim()}`;
      const { data: house, error: findError } = await supabase
        .from('households')
        .select('id')
        .eq('name', codeToSearch)
        .single();

      if (!house) {
        Alert.alert('Hata', 'Bu koda sahip bir aile bulunamadı. Lütfen kodu doğru girdiğinizden emin olun.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('household_members').insert({
        household_id: house.id,
        user_id: currentUser.id,
        role: 'member',
        status: 'accepted'
      });

      if (error) {
        Alert.alert('Hata', 'Aileye katılırken bir hata oluştu. Veritabanı güvenlik (RLS) kuralını güncellediğinizden emin olun veya zaten bu ailede olabilirsiniz.');
      } else {
        setMyHouseholdCode(joinCode.toUpperCase().trim());
        setJoinCode('');
        await loadData(currentUser);
      }
    } catch (e) {
      console.log('Aileye katılırken hata:', e);
      Alert.alert('Hata', 'Bağlantı sorunu veya yetki hatası oluştu. (Supabase RLS kuralını güncellediğinizden emin olun)');
    } finally {
      setLoading(false);
    }
  };

  const leaveFamily = async () => {
    let activeUser = currentUser;
    if (!activeUser) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setCurrentUser(data.session.user);
        activeUser = data.session.user;
      } else {
        Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı.');
        return;
      }
    }

    Alert.alert('Aileden Ayrıl', 'Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Ayrıl', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            // Eğer ayrılan kişi admin ise devir işlemini yap
            const myMember = members.find(m => m.user_id === activeUser.id);
            if (myMember && myMember.role === 'admin') {
              // En eski diğer üyeyi bul
              const { data: oldestMember } = await supabase
                .from('household_members')
                .select('id, user_id')
                .eq('household_id', myMember.household_id)
                .neq('user_id', activeUser.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

              if (oldestMember) {
                // Yeni admin yap
                await supabase.from('household_members').update({ role: 'admin' }).eq('id', oldestMember.id);
                console.log('[leaveFamily] Adminlik devredildi:', oldestMember.user_id);
              }
            }

            const { error } = await supabase.from('household_members').delete().eq('user_id', activeUser.id);
            if (error) {
              console.log('Ayrılma hatası:', error);
              Alert.alert('Hata', 'Ağdan ayrılırken sorun oluştu: ' + error.message);
            } else {
              setMyHouseholdCode(null);
              setMembers([]);
              await loadData(activeUser);
            }
          } catch (e: any) {
             Alert.alert('Hata', 'Beklenmeyen hata: ' + e.message);
          } finally {
             setLoading(false);
          }
        }
      }
    ]);
  };

  const kickMember = async (memberUserId: string, memberEmail: string) => {
    let activeUser = currentUser;
    if (!activeUser) return;

    Alert.alert('Üyeyi Çıkar', `${memberEmail} kişisini aileden çıkarmak istediğinize emin misiniz?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkar', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            // Sadece bu hanedeki kaydını sil
            const myMember = members.find(m => m.user_id === activeUser.id);
            if (!myMember) return;

            const { error } = await supabase.from('household_members')
              .delete()
              .eq('household_id', myMember.household_id)
              .eq('user_id', memberUserId);

            if (error) {
              Alert.alert('Hata', 'Üye çıkarılamadı: ' + error.message);
            } else {
              await loadData(activeUser);
            }
          } catch (e: any) {
            Alert.alert('Hata', 'Beklenmeyen hata: ' + e.message);
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const renderMember = ({ item }: { item: any }) => {
    let bgColor = '#F1F5F9';
    let borderColor = '#E2E8F0';
    
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

    const isAdmin = members.find(m => m.user_id === currentUser?.id)?.role === 'admin';
    const isMe = item.user_id === currentUser?.id;

    return (
      <View style={[styles.memberCard, { backgroundColor: bgColor, borderColor, borderWidth: 1 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={styles.memberInfo}>
            <Text style={styles.memberEmail}>{item.email}</Text>
            {item.role === 'admin' && <Text style={{ marginLeft: 6, fontSize: 16 }}>👑</Text>}
            {isMe && <Text style={styles.youBadge}>(Sen)</Text>}
          </View>
          
          {isAdmin && !isMe && (
            <TouchableOpacity style={styles.kickBtn} onPress={() => kickMember(item.user_id, item.email)}>
              <Text style={styles.kickBtnText}>Çıkar</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.statusLargeText}>{item.last_report_status}</Text>
        <Text style={styles.timeText}>Güncelleme: {item.last_report_time}</Text>

        {item.last_report_status.includes('🔴') && item.lat && item.lon && (
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => {
              navigation.navigate('MapTab', { 
                targetLat: item.lat, 
                targetLng: item.lon, 
                targetName: item.full_name 
              });
            }}
          >
            <Text style={styles.mapButtonText}>📍 Konumu Haritada Gör</Text>
          </TouchableOpacity>
        )}
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

      {!myHouseholdCode && (
        <View style={styles.setupContainer}>
          <Text style={styles.setupTitle}>Ailenizle Bağlantıda Kalın</Text>
          <Text style={styles.setupDesc}>Afet anında ailenizin durumunu (Güvende / Tehlikede) anlık olarak görebilmek için bir aile ağı oluşturun veya mevcut ağa katılın.</Text>
          
          <TouchableOpacity style={[styles.createBtn, loading && { opacity: 0.7 }]} onPress={createFamily} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.createBtnText}>Yeni Aile Oluştur</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>VEYA</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.joinContainer}>
            <TextInput
              style={styles.joinInput}
              placeholder="6 Haneli Aile Kodu"
              autoCapitalize="characters"
              maxLength={6}
              value={joinCode}
              onChangeText={setJoinCode}
            />
            <TouchableOpacity style={[styles.joinBtn, loading && { opacity: 0.7 }]} onPress={joinFamily} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.joinBtnText}>Koda Katıl</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {myHouseholdCode && (
        <View style={styles.codeSection}>
          <Text style={styles.codeTitle}>Ailenizin Davet Kodu</Text>
          <Text style={styles.codeValue}>{myHouseholdCode}</Text>
          <Text style={styles.codeHint}>Bu kodu aile bireylerinize göndererek ağınıza katılmalarını sağlayabilirsiniz.</Text>
          
          <TouchableOpacity style={styles.leaveBtn} onPress={leaveFamily}>
            <Text style={styles.leaveBtnText}>Ağdan Ayrıl</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Kriz Merkezi / Hane Üyeleri */}
      {myHouseholdCode && (
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
      )}

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
  setupContainer: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'center',
    marginTop: 20,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  setupDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    color: '#94A3B8',
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  joinContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  joinInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  joinBtn: {
    backgroundColor: '#10B981',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  joinBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  codeSection: {
    backgroundColor: '#FFFBEB',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    marginBottom: 20,
  },
  codeTitle: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 6,
    marginBottom: 8,
  },
  codeHint: {
    fontSize: 12,
    color: '#D97706',
    textAlign: 'center',
    marginBottom: 16,
  },
  leaveBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  leaveBtnText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 12,
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
  kickBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  kickBtnText: {
    color: '#EF4444',
    fontSize: 12,
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
  timeText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  mapButton: {
    marginTop: 10,
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  mapButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
    fontStyle: 'italic'
  },
});

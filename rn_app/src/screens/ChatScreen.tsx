import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { getDb, getLocalMessages, insertLocalMessage } from '../services/db';
import { checkInternetConnection, syncPendingMessages } from '../services/syncService';
import { supabase } from '../services/supabase';
// UUID generator for React Native without native crypto (for expo-managed offline id creation)
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const quickReplies = [
  "Durumum iyi, güvendeyim.",
  "Acil yardıma ihtiyacım var!",
  "Enkaz altındayım.",
  "Yakınlarda toplanma alanı var mı?",
  "İlk yardım malzemesi lazım."
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Bluetooth Simulation State
  const [isBluetoothMode, setIsBluetoothMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const clearChat = async () => {
    Alert.alert(
      'Sohbeti Temizle',
      'Tüm mesajları kalıcı olarak silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Evet, Sil', 
          style: 'destructive', 
          onPress: async () => {
            const db = await getDb();
            await db.runAsync('DELETE FROM messages');
            setMessages([]);
          }
        }
      ]
    );
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const online = await checkInternetConnection();
      setIsOnline(online);

      if (online) {
        await syncPendingMessages();
        // Supabase'den son mesajları çek
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (data && !error) {
          setMessages(data);
          return;
        }
      }
      
      // Offline ise veya Supabase hatası varsa lokalden oku
      const localMsgs = await getLocalMessages();
      setMessages(localMsgs);
    } catch (e) {
      console.error("fetchMessages Error: ", e);
      // Hata olsa bile en azından yerel mesajları göstermeyi dene
      try {
        const localMsgs = await getLocalMessages();
        setMessages(localMsgs);
      } catch(localErr) {
        console.error("Local db Error: ", localErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Eger online ise gercek zamanli yeni mesajlari dinleyebiliriz
    let subscription: any = null;
    checkInternetConnection().then(online => {
      if (online) {
        subscription = supabase
          .channel('public:messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            setMessages(prev => [payload.new, ...prev]);
          })
          .subscribe();
      }
    });

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const newId = generateId();
    const createdAt = new Date().toISOString();
    const tempMsg = {
      id: newId,
      sender_name: isBluetoothMode ? 'Bluetooth (Ben)' : 'Anonim Kullanıcı',
      text: inputText.trim(),
      latitude: null,
      longitude: null,
      status: isBluetoothMode ? 'bluetooth' : (isOnline ? 'synced' : 'pending'),
      created_at: createdAt,
    };

    setMessages(prev => [tempMsg, ...prev]);
    setInputText('');

    if (isBluetoothMode) {
      // Bluetooth simülasyonu: Sadece lokal DB'ye özel formatta yaz ve fake yanıt oluştur
      await insertLocalMessage(tempMsg.id, tempMsg.sender_name, tempMsg.text, null, null, 'bluetooth', tempMsg.created_at);
      
      setTimeout(async () => {
        const replyId = generateId();
        const replyMsg = {
          id: replyId,
          sender_name: 'Yakındaki Cihaz (BT)',
          text: 'Mesajınızı Bluetooth üzerinden aldım! Durumumuz iyi.',
          latitude: null,
          longitude: null,
          status: 'bluetooth',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [replyMsg, ...prev]);
        await insertLocalMessage(replyId, replyMsg.sender_name, replyMsg.text, null, null, 'bluetooth', replyMsg.created_at);
      }, 3000);

      return;
    }

    if (isOnline) {
      const { error } = await supabase.from('messages').insert({
        id: tempMsg.id,
        sender_name: tempMsg.sender_name,
        text: tempMsg.text,
        location: null,
        status: 'synced',
        created_at: tempMsg.created_at,
        is_offline: false,
      });

      if (error) {
        await insertLocalMessage(tempMsg.id, tempMsg.sender_name, tempMsg.text, null, null, 'pending', tempMsg.created_at);
      }
    } else {
      await insertLocalMessage(tempMsg.id, tempMsg.sender_name, tempMsg.text, null, null, 'pending', tempMsg.created_at);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_name === 'Anonim Kullanıcı' || item.sender_name === 'Bluetooth (Ben)';
    const isBT = item.status === 'bluetooth';

    return (
      <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble, isBT && !isMe && { backgroundColor: '#E0E7FF', borderColor: '#818CF8', borderWidth: 1 }]}>
        <Text style={styles.senderName}>{item.sender_name} {isBT && '📶'}</Text>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
          {item.text}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timeText}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMe && (
            <Text style={styles.statusIcon}>
              {item.status === 'pending' ? '🕒' : item.status === 'bluetooth' ? '📶' : '✓'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const toggleBluetooth = () => {
    if (!isBluetoothMode) {
      setIsSearching(true);
      setTimeout(() => setIsSearching(false), 3000); // Simulate searching for 3s
    }
    setIsBluetoothMode(!isBluetoothMode);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={[styles.btToggleBtn, isBluetoothMode && styles.btToggleActive]} onPress={toggleBluetooth}>
          <Text style={styles.btToggleText}>
            {isBluetoothMode ? '🔵 Bluetooth Açık' : '⚪ Bluetooth P2P'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={clearChat}>
          <Text style={styles.clearBtnText}>Sohbeti Temizle</Text>
        </TouchableOpacity>
      </View>

      {isBluetoothMode && isSearching && (
        <View style={styles.radarContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.radarText}>Yakındaki cihazlar aranıyor...</Text>
        </View>
      )}

      {isBluetoothMode && !isSearching && (
        <View style={styles.radarContainerSuccess}>
          <Text style={styles.radarTextSuccess}>✅ 3 Cihaz Bulundu. Güvenli bağlantı kuruldu.</Text>
        </View>
      )}

      {!isBluetoothMode && (
        <View style={[styles.networkBanner, { backgroundColor: isOnline ? '#10B981' : '#F59E0B' }]}>
          <Text style={styles.networkText}>
            {isOnline ? 'Online Mesajlaşma' : 'Offline Mesajlaşma - Mesajlarınız beklemeye alındı'}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted // Mesajları alttan yukarı sıralar
          contentContainerStyle={styles.listContainer}
        />
      )}

      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.quickReplyContainer}
          contentContainerStyle={styles.quickReplyContent}
        >
          {quickReplies.map((reply, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.quickReplyBtn}
              onPress={() => setInputText(reply)}
            >
              <Text style={styles.quickReplyText}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Acil durum mesajınızı yazın..."
          placeholderTextColor="#94A3B8"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Gönder</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  networkBanner: {
    padding: 8,
    alignItems: 'center',
  },
  networkText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  myBubble: {
    backgroundColor: '#3B82F6',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  senderName: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#FFF',
  },
  otherMessageText: {
    color: '#334155',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  timeText: {
    fontSize: 10,
    color: '#CBD5E1',
    marginRight: 4,
  },
  statusIcon: {
    fontSize: 10,
    color: '#E2E8F0',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#0F172A',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  btToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btToggleActive: {
    backgroundColor: '#E0E7FF',
    borderColor: '#818CF8',
  },
  btToggleText: {
    fontWeight: 'bold',
    color: '#475569',
  },
  clearBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
  },
  clearBtnText: {
    fontWeight: 'bold',
    color: '#EF4444',
  },
  radarContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  radarText: {
    marginTop: 12,
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  radarContainerSuccess: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  radarTextSuccess: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  quickReplyContainer: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickReplyContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  quickReplyBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickReplyText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '500',
  }
});

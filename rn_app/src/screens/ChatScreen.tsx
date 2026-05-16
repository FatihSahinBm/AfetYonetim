import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { getLocalMessages, insertLocalMessage } from '../services/db';
import { checkInternetConnection, syncPendingMessages } from '../services/syncService';
import { supabase } from '../services/supabase';
// UUID generator for React Native without native crypto (for expo-managed offline id creation)
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
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
        setLoading(false);
        return;
      }
    }
    
    // Offline ise veya Supabase hatası varsa lokalden oku
    const localMsgs = await getLocalMessages();
    setMessages(localMsgs);
    setLoading(false);
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
      sender_name: 'Anonim Kullanıcı', // Kimlik doğrulama eklenene kadar
      text: inputText.trim(),
      latitude: null, // Konum servisi entegre edilirse doldurulacak
      longitude: null,
      status: isOnline ? 'synced' : 'pending',
      created_at: createdAt,
    };

    // UI'ı anında güncelle
    setMessages(prev => [tempMsg, ...prev]);
    setInputText('');

    if (isOnline) {
      // Direkt Supabase'e yaz
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
        // Gönderilemediyse locale kaydet
        await insertLocalMessage(tempMsg.id, tempMsg.sender_name, tempMsg.text, null, null, 'pending', tempMsg.created_at);
      }
    } else {
      // Offline'sa locale kaydet
      await insertLocalMessage(tempMsg.id, tempMsg.sender_name, tempMsg.text, null, null, 'pending', tempMsg.created_at);
      
      // Offline AI Bot Mantığı
      const lowerText = tempMsg.text.toLowerCase();
      let botReply = '';
      if (lowerText.includes('kanama')) {
        botReply = 'Afet Asistanı: Kanamaya temiz bir bezle doğrudan baskı yapın ve o bölgeyi kalp seviyesinden yukarıda tutun.';
      } else if (lowerText.includes('yardım') || lowerText.includes('imdat')) {
        botReply = 'Afet Asistanı: Acil durum sinyaliniz cihazınıza kaydedildi. İnternet gelir gelmez ekiplere iletilecek. Ana sayfadaki sirenle sesinizi duyurmaya çalışın.';
      } else if (lowerText.includes('deprem')) {
        botReply = 'Afet Asistanı: Sarsıntı bittikten sonra binayı terk edip ana sayfadan size en yakın toplanma alanına gidin.';
      }

      if (botReply) {
        const botId = generateId();
        const botMsg = {
          id: botId,
          sender_name: 'Afet Asistanı 🤖',
          text: botReply,
          latitude: null,
          longitude: null,
          status: 'pending',
          created_at: new Date().toISOString(),
        };
        setTimeout(async () => {
          setMessages(prev => [botMsg, ...prev]);
          await insertLocalMessage(botMsg.id, botMsg.sender_name, botMsg.text, null, null, 'pending', botMsg.created_at);
        }, 1000);
      }
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_name === 'Anonim Kullanıcı'; // Geçici mantık
    return (
      <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
        <Text style={styles.senderName}>{item.sender_name}</Text>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
          {item.text}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timeText}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMe && (
            <Text style={styles.statusIcon}>
              {item.status === 'pending' ? '🕒' : '✓'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.networkBanner, { backgroundColor: isOnline ? '#10B981' : '#F59E0B' }]}>
        <Text style={styles.networkText}>
          {isOnline ? 'Online Mesajlaşma' : 'Offline Mesajlaşma - Mesajlarınız beklemeye alındı'}
        </Text>
      </View>

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
});

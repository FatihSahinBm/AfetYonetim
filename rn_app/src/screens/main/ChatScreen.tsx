/**
 * Mesajlaşma Ekranı (Online + Offline Mesh)
 * 
 * İnternet varken Supabase üzerinden, yokken Bridgefy mesh ağı
 * üzerinden mesajlaşma sağlar. Otomatik mod tespiti yapar.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config/constants';
import { MeshMessage } from '../../types';
import { broadcastMessage, addMessageListener, removeMessageListener, isMeshActive, getConnectedPeers } from '../../services/meshService';

const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [meshActive, setMeshActive] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Mesh durumunu kontrol et
    setMeshActive(isMeshActive());
    setPeerCount(getConnectedPeers().length);

    // Gelen mesh mesajlarını dinle
    const listener = (message: MeshMessage) => {
      setMessages((prev) => [...prev, message]);
    };
    addMessageListener(listener);

    return () => removeMessageListener(listener);
  }, []);

  /** Mesaj gönder */
  const sendMessage = async () => {
    if (!inputText.trim()) return;

    // Lokale ekle
    const localMessage: MeshMessage = {
      id: `local_${Date.now()}`,
      sender_id: 'me',
      sender_name: 'Ben',
      type: 'chat',
      content: inputText,
      timestamp: Date.now(),
      hop_count: 0,
      ttl: 86400000,
    };
    setMessages((prev) => [...prev, localMessage]);

    // Mesh üzerinden yayınla
    await broadcastMessage('chat', inputText, 'Kullanıcı');
    setInputText('');
  };

  /** Mesaj kartını render et */
  const renderMessage = ({ item }: { item: MeshMessage }) => {
    const isMe = item.sender_id === 'me';
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.otherMessage]}>
        {!isMe && <Text style={styles.senderName}>{item.sender_name}</Text>}
        <Text style={styles.messageText}>{item.content}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {item.hop_count > 0 && (
            <Text style={styles.hopInfo}>📡 {item.hop_count} hop</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Üst bilgi çubuğu */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 Offline Mesajlaşma</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: meshActive ? COLORS.success : COLORS.danger }]} />
          <Text style={styles.statusText}>
            {meshActive ? `Mesh Aktif • ${peerCount} cihaz` : 'Mesh Bağlantısız'}
          </Text>
        </View>
      </View>

      {/* Mesaj listesi */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>Mesh Mesajlaşma</Text>
            <Text style={styles.emptyText}>
              İnternet olmadan yakındaki cihazlarla mesajlaşın.{'\n'}
              Mesajlar Bluetooth üzerinden iletilir.
            </Text>
          </View>
        }
      />

      {/* Mesaj girişi */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Mesajınızı yazın..."
          placeholderTextColor={COLORS.grey}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  header: {
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, color: COLORS.grey },
  messageList: { padding: 16, paddingBottom: 8 },
  messageBubble: { maxWidth: '78%', padding: 12, borderRadius: 16, marginBottom: 8 },
  myMessage: {
    backgroundColor: COLORS.primary, alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  senderName: { fontSize: 12, color: COLORS.info, fontWeight: '600', marginBottom: 4 },
  messageText: { fontSize: 15, color: COLORS.white, lineHeight: 20 },
  messageFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timestamp: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  hopInfo: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  emptyState: { alignItems: 'center', paddingTop: 100 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  emptyText: { fontSize: 14, color: COLORS.grey, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  inputBar: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)', alignItems: 'flex-end',
  },
  textInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.white,
    maxHeight: 100, marginRight: 10,
  },
  sendButton: {
    backgroundColor: COLORS.primary, width: 44, height: 44,
    borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
  sendIcon: { fontSize: 20, color: COLORS.white },
});

export default ChatScreen;

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

export default function InfoScreen() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'bot',
      text: 'Merhaba, ben Afet Asistanı. İlk yardım, deprem çantası, toplanma alanları veya acil durumlar hakkında bana sorular sorabilirsiniz.\n\nÖrnekler:\n- "Deprem anında ne yapmalıyım?"\n- "Kanama durumunda ilk yardım nasıldır?"\n- "Deprem çantasında neler olmalı?"'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (!inputText.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // Chatbot Mantığı
    const lowerText = userMsg.text.toLowerCase();
    let botReply = 'Üzgünüm, bunu anlayamadım. Lütfen "deprem, yangın, kanama, çanta" gibi anahtar kelimeler kullanarak tekrar deneyin.';

    if (lowerText.includes('kanama') || lowerText.includes('yaralanma') || lowerText.includes('kanıyor')) {
      botReply = 'Kanamalarda İlk Yardım:\nTemiz bir bezle yara üzerine doğrudan baskı uygulayın. Kanama durana kadar baskıyı sürdürün. Kanayan bölgeyi kalp seviyesinden yukarıda tutmaya çalışın.';
    } else if (lowerText.includes('kırık') || lowerText.includes('çıkık')) {
      botReply = 'Kırık ve Çıkıklar:\nYaralı bölgeyi hareket ettirmeyin. Sert bir cisim (tahta parçası, kalın karton) ile sabitleyin ve hemen tıbbi yardım çağırın.';
    } else if (lowerText.includes('yanık') || lowerText.includes('yandı')) {
      botReply = 'Yanıklar:\nYanan bölgeyi en az 10 dakika boyunca akan serin (buzlu değil) su altında tutun. Yanık üzerine krem veya yoğurt gibi şeyler sürmeyin.';
    } else if (lowerText.includes('şok')) {
      botReply = 'Şok Durumu:\nHastayı sırt üstü yatırın ve ayaklarını 30 cm kadar yukarı kaldırın. Vücut ısısını korumak için üzerini örtün ve sakinleşmesini sağlayın.';
    } else if (lowerText.includes('yardım') || lowerText.includes('imdat') || lowerText.includes('kurtarın')) {
      botReply = 'Sakin olun. Ana sayfadaki SİREN butonuna basarak enkaz altında sesinizi arama kurtarma ekiplerine duyurabilirsiniz. Eğer güvende değilseniz, ana sayfadan "Mahsur Kaldım" butonuna basın.';
    } else if (lowerText.includes('deprem') || lowerText.includes('sarsıntı')) {
      botReply = 'Deprem Anında:\nBina içindeyseniz ÇÖK-KAPAN-TUTUN pozisyonu alın. Sarsıntı bittikten sonra asansörü KULLANMADAN binayı terk edin ve ana sayfadaki Harita bölümünden size en yakın toplanma alanına gidin.';
    } else if (lowerText.includes('yangın') || lowerText.includes('ateş') || lowerText.includes('duman')) {
      botReply = 'Yangın Durumunda:\nIslak bir bezle ağzınızı kapatın ve yere yakın durarak (sürünerek) acil çıkışlara yönelin. Kesinlikle asansör kullanmayın!';
    } else if (lowerText.includes('enkaz') || lowerText.includes('göçük') || lowerText.includes('sıkıştım')) {
      botReply = 'Enkaz Altında:\nLütfen panik yapmayın. Enerjinizi tasarruflu kullanın. Rastgele bağırmak yerine, dışarıdan ses duyduğunuzda ritmik olarak sert bir yere (kalorifer borusu, duvar vb.) vurun.';
    } else if (lowerText.includes('çanta') || lowerText.includes('hazırlık')) {
      botReply = 'Deprem Çantasında Olması Gerekenler:\n• Su (Kişi başı en az 3 gün yetecek kadar)\n• Bozulmayan gıdalar (Konserve, bisküvi vb.)\n• İlk yardım çantası ve sürekli kullanılan ilaçlar\n• Pilli radyo, el feneri ve yedek piller\n• Düdük\n• Nakit para ve önemli evrakların fotokopileri\n• Çok amaçlı çakı\n• Battaniye veya uyku tulumu';
    } else if (lowerText.includes('merhaba') || lowerText.includes('selam') || lowerText.includes('bot')) {
      botReply = 'Merhaba! Ben sizin kişisel Afet ve İlk Yardım Asistanınızım. İnternet olmasa da size her zaman destek olabilirim. Aklınızdaki soruyu sorabilirsiniz.';
    }

    const botMsg = {
      id: (Date.now() + 1).toString(),
      sender: 'bot',
      text: botReply
    };

    setTimeout(() => {
      setMessages(prev => [...prev, botMsg]);
    }, 600);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isBot = item.sender === 'bot';
    return (
      <View style={[styles.messageWrapper, isBot ? styles.botWrapper : styles.userWrapper]}>
        {isBot && <Text style={styles.botIcon}>🤖</Text>}
        <View style={[styles.messageBubble, isBot ? styles.botBubble : styles.userBubble]}>
          <Text style={[styles.messageText, isBot ? styles.botText : styles.userText]}>{item.text}</Text>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Afet Asistanı & İlk Yardım</Text>
        <Text style={styles.headerSub}>İnternetsiz de çalışır.</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Soru sorun (Örn: Deprem çantası...)"
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
          <Text style={styles.sendButtonText}>Sor</Text>
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
  header: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  headerSub: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '600'
  },
  listContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  botWrapper: {
    alignSelf: 'flex-start',
  },
  userWrapper: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  botIcon: {
    fontSize: 24,
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 16,
  },
  botBubble: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  botText: {
    color: '#334155',
  },
  userText: {
    color: '#FFF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    maxHeight: 100,
    color: '#1E293B',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});

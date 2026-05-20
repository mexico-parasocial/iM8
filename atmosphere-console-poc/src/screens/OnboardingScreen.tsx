import { useState } from 'react'
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Icon } from '../components/m8/Icon'
import { tokens } from '../theme'

const { width } = Dimensions.get('window')

const slides = [
  {
    id: '1',
    icon: 'lock' as const,
    title: 'One identity.\nMany faces.',
    body: 'm8 lets you create different personas for different parts of your life. Your civic profile for politics. Your public profile for social. Each with its own proofs and boundaries.',
  },
  {
    id: '2',
    icon: 'shield' as const,
    title: 'Apps get proof.\nNot your data.',
    body: 'When an app needs to know your age or eligibility, m8 sends a sealed proof — not your INE, not your birthdate, not your full name. You control what leaks.',
  },
  {
    id: '3',
    icon: 'zap' as const,
    title: 'Approve once.\nRevoke anytime.',
    body: 'Every app request shows up here. Approve what makes sense. Deny what doesnt. Change your mind later? One tap and the proof is dead.',
  },
  {
    id: '4',
    icon: 'globe' as const,
    title: 'Start with m8.\nLink later.',
    body: 'Create your m8 identity first — no Bluesky or Mastodon required. Your data stays on your device. Link external accounts only when you want to go public.',
  },
]

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <FlatList
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / width)
            setIndex(newIndex)
          }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={styles.iconWrap}>
                <Icon name={item.icon} size={48} color={tokens.accent} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
        />

        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable
          onPress={onDone}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {index === slides.length - 1 ? 'Get started' : 'Skip'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.background,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  slide: {
    width,
    paddingHorizontal: 24,
    paddingTop: 120,
    alignItems: 'flex-start',
  },
  iconWrap: {
    marginBottom: 24,
  },
  title: {
    color: tokens.text,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    marginBottom: 16,
  },
  body: {
    color: tokens.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.stroke,
  },
  dotActive: {
    backgroundColor: tokens.accent,
    width: 24,
  },
  button: {
    backgroundColor: tokens.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: tokens.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
})

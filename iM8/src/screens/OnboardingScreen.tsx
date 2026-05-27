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
    icon: 'shieldCheck' as const,
    title: 'One identity.\nThree cards.',
    body: 'm8 gives you up to three persona cards. Each card is a face you show to the world — but behind all of them lives one central, private identity that guarantees your civic rights.',
  },
  {
    id: '2',
    icon: 'person' as const,
    title: 'Card 1:\nYour PARA voice.',
    body: 'Card 1 is anonymous by default. It carries your civic proofs — eligibility, verification, affiliation — without exposing who you are. Use it to vote, deliberate, and participate in PARA.',
  },
  {
    id: '3',
    icon: 'message' as const,
    title: 'Card 2:\nPost independently.',
    body: 'Card 2 is also anonymous, but unlinked from Card 1. Use it for independent posts, sensitive topics, or anything you want to keep separate from your main civic identity.',
  },
  {
    id: '4',
    icon: 'globe' as const,
    title: 'Card 3:\nGo public.',
    body: 'Card 3 is yours to customize. Link it to Bluesky, Mastodon, or any social network. Build a public profile, share creative work, or network openly — or keep it dormant until you need it.',
  },
  {
    id: '5',
    icon: 'check' as const,
    title: 'One vote.\nGuaranteed.',
    body: 'No matter how many cards you use, your central private identity ensures you can only vote once per policy. Multiple faces, one voice, one vote — that is the m8 promise.',
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

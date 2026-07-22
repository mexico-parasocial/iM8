import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Icon } from '../components/m8/Icon'
import { tokens } from '../theme'
import { hapticLight } from '../utils/haptics'

const slides = [
  {
    id: '1',
    icon: 'shieldCheck' as const,
    title: 'Private civic\nroot.',
    body: 'Civic identity manager by PARA. iM8 starts private, then lets you prove only what each civic action needs.',
  },
  {
    id: '2',
    icon: 'person' as const,
    title: 'Named anonymous\ncards.',
    body: 'Your anonymous cards get separate names from the start. They can carry proof-backed civic facts without implying they belong to the same public identity.',
  },
  {
    id: '3',
    icon: 'globe' as const,
    title: 'Public only\nby choice.',
    body: 'Instagram, X, and Bluesky stay unlinked until you decide to create a public identity from the + Public slot. No public card is created before that moment.',
  },
  {
    id: '4',
    icon: 'check' as const,
    title: 'Many faces.\nOne vote.',
    body: 'The private root prevents duplicate voting. Each card can carry granular ZKP proofs, but the system only allows one vote across all of them.',
  },
]

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const slide = slides[index]
  const isLast = index === slides.length - 1

  const goTo = (next: number) => {
    hapticLight()
    setIndex(next)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.slide}>
          <Text style={styles.brand}>iM8</Text>
          <View style={styles.iconWrap}>
            <Icon name={slide.icon} size={48} color={tokens.accent} />
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </View>

        <View style={styles.dots}>
          {slides.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => goTo(i)}
              hitSlop={8}
              accessibilityLabel={`Go to slide ${i + 1}`}
            >
              <View style={[styles.dot, i === index && styles.dotActive]} />
            </Pressable>
          ))}
        </View>

        <View style={styles.buttonRow}>
          {!isLast ? (
            <Pressable onPress={onDone} hitSlop={8} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => (isLast ? onDone() : goTo(index + 1))}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {isLast ? 'Get started' : 'Next'}
            </Text>
          </Pressable>
        </View>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  iconWrap: {
    marginBottom: 24,
  },
  brand: {
    color: tokens.success,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 20,
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
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skipButton: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  skipText: {
    color: tokens.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  button: {
    flex: 1,
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

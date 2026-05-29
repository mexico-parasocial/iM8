import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native'
import { Icon } from './Icon'

// ── Props ──
type Props = {
  title: string
  explanation: string
}

export default function InfoTooltip({ title, explanation }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={styles.infoButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.infoIcon}>ⓘ</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Icon name="circleX" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.explanation}>{explanation}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  infoButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  infoIcon: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  close: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
  explanation: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
  },
})

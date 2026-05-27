import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
} from 'react-native'
import { Icon } from './Icon'
import { tokens } from '../../theme'

// ── Props ──
type Props = {
  visible: boolean
  onClose: () => void
  isModerator: boolean
  onToggleModerator: (enabled: boolean) => void
  darkMode: boolean
  onToggleDarkMode: (enabled: boolean) => void
}

export default function MyBaseSettingsModal({
  visible,
  onClose,
  isModerator,
  onToggleModerator,
  darkMode,
  onToggleDarkMode,
}: Props) {
  const [showModeratorConfirm, setShowModeratorConfirm] = useState(false)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>MyBase Settings</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Icon name="circleX" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Appearance */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appearance</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Dark mode</Text>
                <Switch
                  value={darkMode}
                  onValueChange={onToggleDarkMode}
                  trackColor={{ false: '#334155', true: '#3B82F6' }}
                  thumbColor={darkMode ? '#F8FAFC' : '#94A3B8'}
                />
              </View>
            </View>

            {/* Moderator */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Moderation</Text>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Moderator mode</Text>
                  <Text style={styles.rowSub}>
                    Review and endorse knowledge bundles
                  </Text>
                </View>
                <Switch
                  value={isModerator}
                  onValueChange={(v) => {
                    if (v) setShowModeratorConfirm(true)
                    else onToggleModerator(false)
                  }}
                  trackColor={{ false: '#334155', true: '#F59E0B' }}
                  thumbColor={isModerator ? '#F8FAFC' : '#94A3B8'}
                />
              </View>

              {isModerator && (
                <View style={styles.moderatorInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="shield" size={14} color={tokens.accent} />
                    <Text style={styles.moderatorText}>
                      Active moderator. You can endorse, challenge, or request
                      revisions on submitted bundles.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Data */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Data</Text>
              <TouchableOpacity style={styles.actionRow}>
                <Text style={styles.actionText}>Export knowledge graph</Text>
                <Text style={styles.actionArrow}>→</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionRow}>
                <Text style={styles.actionText}>Sync now</Text>
                <Text style={styles.actionArrow}>→</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionRow, styles.dangerRow]}>
                <Text style={[styles.actionText, styles.dangerText]}>
                  Clear local canvas
                </Text>
              </TouchableOpacity>
            </View>

            {/* About */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.aboutText}>
                MyBase v0.1 — Local-first knowledge canvas with permissioned space
                sync. Built on AT Protocol.
              </Text>
            </View>
          </ScrollView>
        </View>

        {/* Moderator confirm modal */}
        {showModeratorConfirm && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmSheet}>
              <Text style={styles.confirmTitle}>Enable moderator mode?</Text>
              <Text style={styles.confirmBody}>
                This will expose the moderation queue and allow you to endorse or
                challenge knowledge bundles. Your endorsements are public and
                attributed.
              </Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmCancel]}
                  onPress={() => setShowModeratorConfirm(false)}
                >
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmEnable]}
                  onPress={() => {
                    onToggleModerator(true)
                    setShowModeratorConfirm(false)
                  }}
                >
                  <Text style={styles.confirmEnableText}>Enable</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  moderatorInfo: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  moderatorText: {
    color: '#93C5FD',
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  actionText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  actionArrow: {
    color: '#94A3B8',
    fontSize: 16,
  },
  dangerRow: {
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  dangerText: {
    color: '#FCA5A5',
  },
  aboutText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  confirmSheet: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  confirmTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  confirmBody: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmCancel: {
    backgroundColor: '#334155',
  },
  confirmCancelText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmEnable: {
    backgroundColor: '#F59E0B',
  },
  confirmEnableText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '700',
  },
})

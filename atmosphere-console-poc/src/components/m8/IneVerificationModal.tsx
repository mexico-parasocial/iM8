import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { buttonStyle, buttonTextStyle } from './Button'
import { cardStyle } from './Card'
import { pillStyle, pillTextStyle } from './Pill'
import { tokens } from '../../theme'
import { type IneVerificationRecord, type IneVerificationStatus } from '../../types'

const STEPS: { status: IneVerificationStatus; label: string; emoji: string; detail: string }[] = [
  { status: 'not_started', label: 'Start', emoji: '📷', detail: 'Scan the front of your INE' },
  { status: 'scanning', label: 'Scanning', emoji: '📸', detail: 'Capture both sides of your INE' },
  { status: 'ocr_processing', label: 'Reading', emoji: '🔍', detail: 'Extracting data from your INE' },
  { status: 'face_matching', label: 'Verify', emoji: '🙂', detail: 'Match your face to the INE photo' },
  { status: 'verified', label: 'Done', emoji: '✅', detail: 'Your civic proofs are ready' },
]

const MEXICAN_STATES: Record<string, string> = {
  '01': 'Aguascalientes', '02': 'Baja California', '03': 'Baja California Sur',
  '04': 'Campeche', '05': 'Coahuila', '06': 'Colima', '07': 'Chiapas',
  '08': 'Chihuahua', '09': 'CDMX', '10': 'Durango', '11': 'Guanajuato',
  '12': 'Guerrero', '13': 'Hidalgo', '14': 'Jalisco', '15': 'México',
  '16': 'Michoacán', '17': 'Morelos', '18': 'Nayarit', '19': 'Nuevo León',
  '20': 'Oaxaca', '21': 'Puebla', '22': 'Querétaro', '23': 'Quintana Roo',
  '24': 'San Luis Potosí', '25': 'Sinaloa', '26': 'Sonora', '27': 'Tabasco',
  '28': 'Tamaulipas', '29': 'Tlaxcala', '30': 'Veracruz', '31': 'Yucatán',
  '32': 'Zacatecas',
}

export function IneVerificationModal({
  visible,
  onClose,
  onComplete,
  existingRecord,
}: {
  visible: boolean
  onClose: () => void
  onComplete: (record: IneVerificationRecord) => void
  existingRecord?: IneVerificationRecord
}) {
  const [step, setStep] = useState<IneVerificationStatus>(existingRecord?.status ?? 'not_started')
  const [record, setRecord] = useState<Partial<IneVerificationRecord>>(existingRecord ?? { id: `ine-${Date.now()}`, proofs: { isMexicanCitizen: false, isAgeEligible: false, hasIne: false } })
  const [scanning, setScanning] = useState(false)

  const currentStepIndex = STEPS.findIndex((s) => s.status === step)
  const isComplete = step === 'verified'
  const isFailed = step === 'failed' || step === 'rejected'

  function simulateScan() {
    setScanning(true)
    setStep('scanning')
    setTimeout(() => {
      setStep('ocr_processing')
      setRecord({
        ...record,
        curp: 'CURP123456HDFXXX01',
        fullName: 'José García Martínez',
        birthDate: '1995-03-15',
        gender: 'M',
        stateCode: '08',
        municipalityCode: '019',
        section: '1234',
        ineNumber: '1234567890123',
        cic: '1234567890',
        ocr: '123456789012345',
      })
      setTimeout(() => {
        setStep('face_matching')
        setTimeout(() => {
          setStep('verified')
          setRecord({
            ...record,
            verifiedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
            proofs: {
              isMexicanCitizen: true,
              isAgeEligible: true,
              ageRange: '26-35',
              state: MEXICAN_STATES['08'],
              gender: 'M',
              hasIne: true,
            },
          })
          setScanning(false)
        }, 2000)
      }, 2000)
    }, 2000)
  }

  function handleComplete() {
    if (record.proofs && record.verifiedAt) {
      onComplete(record as IneVerificationRecord)
    }
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>🇲🇽 INE Verification</Text>
          <Text style={styles.subtitle}>
            Verify your Mexican civic identity. Your INE data stays private — only proofs are shared with apps.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Progress Steps */}
            <View style={styles.stepsRow}>
              {STEPS.map((s, i) => (
                <View key={s.status} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      i <= currentStepIndex && styles.stepCircleActive,
                      isFailed && i === currentStepIndex && styles.stepCircleFailed,
                    ]}
                  >
                    <Text style={styles.stepEmoji}>{s.emoji}</Text>
                  </View>
                  <Text style={[styles.stepLabel, i <= currentStepIndex && styles.stepLabelActive]}>
                    {s.label}
                  </Text>
                  {i < STEPS.length - 1 && <View style={[styles.stepLine, i < currentStepIndex && styles.stepLineActive]} />}
                </View>
              ))}
            </View>

            {/* Current Step Detail */}
            {step === 'not_started' && (
              <View style={cardStyle('filled')}>
                <Text style={styles.stepDetailEmoji}>📷</Text>
                <Text style={styles.stepDetailTitle}>Scan your INE</Text>
                <Text style={styles.stepDetailBody}>
                  We need both sides of your INE (Instituto Nacional Electoral) credential. The data is processed on your device and encrypted.
                </Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bullet}>• Front side: photo, name, CURP</Text>
                  <Text style={styles.bullet}>• Back side: address, section, cic/ocr</Text>
                  <Text style={styles.bullet}>• Face match: verify it's really you</Text>
                </View>
                <Pressable onPress={simulateScan} style={[buttonStyle('primary'), { marginTop: 12 }]}>
                  <Text style={buttonTextStyle('primary')}>Start INE scan</Text>
                </Pressable>
              </View>
            )}

            {scanning && (
              <View style={cardStyle('accent')}>
                <Text style={styles.scanningEmoji}>⏳</Text>
                <Text style={styles.scanningTitle}>{STEPS.find((s) => s.status === step)?.detail}</Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.scanningHint}>This usually takes under 30 seconds</Text>
              </View>
            )}

            {isComplete && record.proofs && (
              <View style={cardStyle('filled')}>
                <Text style={styles.successEmoji}>🎉</Text>
                <Text style={styles.successTitle}>INE Verified</Text>
                <Text style={styles.successBody}>
                  Your Mexican civic identity is now verified. Here are the proofs apps can request:
                </Text>

                <View style={styles.proofsGrid}>
                  <ProofBadge label="Mexican citizen" value={record.proofs.isMexicanCitizen ? 'Yes' : 'No'} active={record.proofs.isMexicanCitizen} />
                  <ProofBadge label="Age eligible" value={record.proofs.isAgeEligible ? 'Yes' : 'No'} active={record.proofs.isAgeEligible} />
                  <ProofBadge label="Age range" value={record.proofs.ageRange ?? 'Unknown'} active={!!record.proofs.ageRange} />
                  <ProofBadge label="State" value={record.proofs.state ?? 'Unknown'} active={!!record.proofs.state} />
                  <ProofBadge label="Gender" value={record.proofs.gender ?? 'Unknown'} active={!!record.proofs.gender} />
                  <ProofBadge label="Has INE" value={record.proofs.hasIne ? 'Yes' : 'No'} active={record.proofs.hasIne} />
                </View>

                <View style={[cardStyle('warning'), { marginTop: 12 }]}>
                  <Text style={styles.warningTitle}>⚠️ Raw data stays private</Text>
                  <Text style={styles.warningBody}>
                    Apps never see your CURP, full name, or INE number. They only receive the proofs above when you explicitly approve a grant.
                  </Text>
                </View>

                <Pressable onPress={handleComplete} style={[buttonStyle('primary'), { marginTop: 12 }]}>
                  <Text style={buttonTextStyle('primary')}>Save to my vault</Text>
                </Pressable>
              </View>
            )}

            {isFailed && (
              <View style={cardStyle('danger')}>
                <Text style={styles.failEmoji}>❌</Text>
                <Text style={styles.failTitle}>Verification failed</Text>
                <Text style={styles.failBody}>
                  We couldn't verify your INE. This could be due to poor image quality, mismatched face, or an invalid credential.
                </Text>
                <Pressable onPress={() => { setStep('not_started'); setScanning(false); }} style={[buttonStyle('secondary'), { marginTop: 12 }]}>
                  <Text style={buttonTextStyle('secondary')}>Try again</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={buttonStyle('secondary')}>
              <Text style={buttonTextStyle('secondary')}>{isComplete ? 'Done' : 'Cancel'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function ProofBadge({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <View style={[styles.proofBadge, active && styles.proofBadgeActive]}>
      <Text style={styles.proofBadgeLabel}>{label}</Text>
      <Text style={[styles.proofBadgeValue, active && styles.proofBadgeValueActive]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: tokens.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.stroke,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: tokens.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 16,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 2,
    borderColor: tokens.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    borderColor: tokens.accent,
    backgroundColor: tokens.accentTransparent,
  },
  stepCircleFailed: {
    borderColor: tokens.danger,
    backgroundColor: tokens.dangerTransparent,
  },
  stepEmoji: {
    fontSize: 20,
  },
  stepLabel: {
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  stepLabelActive: {
    color: tokens.accentSoft,
    fontWeight: '700',
  },
  stepLine: {
    position: 'absolute',
    top: 22,
    right: -20,
    width: 40,
    height: 2,
    backgroundColor: tokens.stroke,
  },
  stepLineActive: {
    backgroundColor: tokens.accent,
  },
  stepDetailEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  stepDetailTitle: {
    color: tokens.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDetailBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  bulletList: {
    gap: 6,
    marginTop: 12,
  },
  bullet: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  scanningEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  scanningTitle: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.stroke,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.accent,
    borderRadius: 3,
  },
  scanningHint: {
    color: tokens.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  successEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  successTitle: {
    color: tokens.success,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  successBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  proofsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  proofBadge: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.stroke,
    backgroundColor: tokens.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 100,
    flex: 1,
  },
  proofBadgeActive: {
    borderColor: tokens.success + '60',
    backgroundColor: tokens.success + '15',
  },
  proofBadgeLabel: {
    color: tokens.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  proofBadgeValue: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  proofBadgeValueActive: {
    color: tokens.success,
  },
  warningTitle: {
    color: tokens.warning,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningBody: {
    color: tokens.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  failEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  failTitle: {
    color: tokens.danger,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  failBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
})

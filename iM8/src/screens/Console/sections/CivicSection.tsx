import { Pressable, StyleSheet, Text, View } from 'react-native'
import { cardStyle } from '../../../components/m8/Card'
import { buttonStyle, buttonTextStyle } from '../../../components/m8/Button'
import { pillStyle, pillTextStyle } from '../../../components/m8/Pill'
import { MiniStat, CoreRow, EmptyState } from '../../../components/m8/ConsolePrimitives'
import { Icon, type IconName } from '../../../components/m8/Icon'
import type { IneVerificationRecord } from '../../../types'
import { tokens } from '../../../theme'

export function CivicSection({
  ineRecord,
  onStartVerification,
  onViewProofs,
  onRequestGrant,
  theme,
}: {
  ineRecord: IneVerificationRecord | undefined
  onStartVerification: () => void
  onViewProofs: () => void
  onRequestGrant?: (appName: string, claim: string) => void
  theme: typeof tokens
}) {
  const status = ineRecord?.status ?? 'not_started'
  const isVerified = status === 'verified'
  const isInProgress = status !== 'not_started' && status !== 'verified' && status !== 'failed' && status !== 'rejected'

  return (
    <View style={styles.stack}>
      {/* Privacy Promise — moved to top */}
      <View style={cardStyle('warning')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="lock" size={14} color={tokens.warning} />
          <Text style={styles.warningTitle}>Privacy promise</Text>
        </View>
        <Text style={styles.warningBody}>
          Your CURP, full name, INE number, and photo are encrypted on your device. Apps only receive the proofs you explicitly approve. You can revoke civic proofs at any time from the Grants section.
        </Text>
      </View>

      {/* Hero card */}
      <View style={cardStyle('accent')}>
        <Text style={styles.summaryEyebrow}>Mexican Civic Identity</Text>
        <Text style={styles.summaryTitle}>
          {isVerified ? 'INE verified' : isInProgress ? 'Verification in progress' : 'Verify your INE'}
        </Text>
        <Text style={styles.summaryBody}>
          {isVerified
            ? 'Your Mexican electoral credential is verified. Apps can request civic proofs without seeing your raw data.'
            : 'Scan your INE to unlock civic features in PARA — voting, petitions, verified comments, and regional communities. Your data stays private.'}
        </Text>

        {isVerified && ineRecord?.proofs && (
          <View style={styles.statRow}>
            <MiniStat label="Citizen" value={ineRecord.proofs.isMexicanCitizen ? 'Yes' : 'No'} />
            <MiniStat label="Age eligible" value={ineRecord.proofs.isAgeEligible ? 'Yes' : 'No'} />
            <MiniStat label="State" value={ineRecord.proofs.state ?? '—'} />
            <MiniStat label="Gender" value={ineRecord.proofs.gender ?? '—'} />
          </View>
        )}

        <Pressable
          onPress={isVerified ? onViewProofs : onStartVerification}
          style={[buttonStyle(isVerified ? 'secondary' : 'primary'), { marginTop: 12 }]}
        >
          <Text style={buttonTextStyle(isVerified ? 'secondary' : 'primary')}>
            {isVerified ? 'View civic proofs' : isInProgress ? 'Continue verification' : 'Start INE verification'}
          </Text>
        </Pressable>
      </View>

      {/* What you unlock */}
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>What you unlock</Text>
        <CivicFeatureRow
          icon="flag"
          title="Verified voting"
          detail="Vote on proposals and polls with proof of citizenship."
          locked={!isVerified}
        />
        <CivicFeatureRow
          icon="pencil"
          title="Digital petitions"
          detail="Sign civic petitions that require verified identity."
          locked={!isVerified}
        />
        <CivicFeatureRow
          icon="message"
          title="Verified comments"
          detail="Comment on political posts with a verified badge."
          locked={!isVerified}
        />
        <CivicFeatureRow
          icon="home"
          title="Regional communities"
          detail="Join state and municipality groups."
          locked={!isVerified}
        />
        <CivicFeatureRow
          icon="shieldCheck"
          title="Civic badges"
          detail="Display voter status, age range, and region without revealing raw data."
          locked={!isVerified}
        />
      </View>

      {/* How it works — stepper */}
      <View style={cardStyle('filled')}>
        <Text style={styles.summaryEyebrow}>How it works</Text>
        <StepperStep number={1} title="Scan both sides" completed={isVerified || isInProgress} />
        <StepperStep number={2} title="Match your face" completed={isVerified || (isInProgress && (ineRecord?.status === 'face_matching' || ineRecord?.status === 'verified'))} />
        <StepperStep number={3} title="Extract proofs" completed={isVerified} current={isInProgress && ineRecord?.status === 'ocr_processing'} />
        <StepperStep number={4} title="Encrypt data" completed={isVerified} />
        <StepperStep number={5} title="Approve grants" completed={isVerified} current={isVerified} />
      </View>
    </View>
  )
}

function StepperStep({ number, title, completed, current }: { number: number; title: string; completed?: boolean; current?: boolean }) {
  return (
    <View style={styles.stepperRow}>
      <View style={[styles.stepperDot, completed && styles.stepperDotCompleted, current && styles.stepperDotCurrent]}>
        {completed ? (
          <Icon name="check" size={12} color={tokens.success} />
        ) : (
          <Text style={[styles.stepperNumber, current && styles.stepperNumberCurrent]}>
            {number}
          </Text>
        )}
      </View>
      <Text style={[styles.stepperText, completed && styles.stepperTextCompleted, current && styles.stepperTextCurrent]}>
        {title}
      </Text>
    </View>
  )
}

function CivicFeatureRow({ icon, title, detail, locked }: { icon: IconName; title: string; detail: string; locked: boolean }) {
  return (
    <View style={[styles.featureRow, { opacity: locked ? 0.5 : 1 }]}>
      <View style={{ marginRight: 12 }}>
        <Icon name={icon} size={22} color={locked ? tokens.muted : tokens.text} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>
          {locked && (
            <View style={pillStyle('warning')}>
              <Text style={pillTextStyle('warning')}>Locked</Text>
            </View>
          )}
        </View>
        <Text style={{ color: tokens.muted, fontSize: 13 }}>{detail}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    marginTop: 12,
  },
  listCard: {
    gap: 8,
  },
  listTitle: {
    color: tokens.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  summaryEyebrow: {
    color: tokens.accentSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  summaryTitle: {
    color: tokens.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
  },
  summaryBody: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 12,
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
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.stroke + '40',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  stepperDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDotCompleted: {
    backgroundColor: tokens.success + '20',
    borderColor: tokens.success,
  },
  stepperDotCurrent: {
    backgroundColor: tokens.accent + '20',
    borderColor: tokens.accent,
  },
  stepperNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.muted,
  },
  stepperNumberCompleted: {
    color: tokens.success,
  },
  stepperNumberCurrent: {
    color: tokens.accent,
  },
  stepperText: {
    fontSize: 14,
    color: tokens.muted,
  },
  stepperTextCompleted: {
    color: tokens.muted,
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  stepperTextCurrent: {
    color: tokens.text,
    fontWeight: '700',
  },
})

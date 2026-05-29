import {
  type ClaimDescriptor,
  type ConsentLedgerEntry,
  type ConsentPolicy,
  type PdsSafetyPolicy,
  type PdsSafetySnapshot,
  type ProofLifecycleCopy,
  type SafetyAction,
} from '../types'

export function buildSafetySnapshot(handle: string): PdsSafetySnapshot {
  if (handle.includes('move') || handle.includes('recover')) {
    return {
      state: 'Needs attention',
      detail: 'Backup exists, but the last repo check found follow-up work before proofs should be relied on.',
      source: 'pdsmoover.network',
      lastBackup: '2 days ago',
    }
  }

  if (handle.includes('new') || handle.includes('fresh')) {
    return {
      state: 'Enroll now',
      detail: 'No backup enrollment is linked yet, so grant portability would be weak during account recovery.',
      source: 'pdsmoover.network',
      lastBackup: 'Not enrolled',
    }
  }

  return {
    state: 'Backed up',
    detail: 'Repo backup is active, migration checks are healthy, and proof revocation can be replayed after a move.',
    source: 'pdsmoover.network',
    lastBackup: '6 hours ago',
  }
}

export function buildSafetyActions(): SafetyAction[] {
  return [
    {
      title: 'Review backup enrollment',
      detail: 'Confirm the account is enrolled in PDS MOOver before relying on long-lived grants.',
      urgency: 'Now',
      onPress: () => {},
      cta: 'Review',
    },
    {
      title: 'Check proof expiry windows',
      detail: 'Short-lived proofs reduce blast radius when a partner app or provider becomes risky.',
      urgency: 'Soon',
      onPress: () => {},
      cta: 'Check',
    },
    {
      title: 'Audit stale grants',
      detail: 'Revoke or expire claims that no longer support a current app relationship.',
      urgency: 'Optional',
      onPress: () => {},
      cta: 'Audit',
    },
  ]
}

export function buildConsentLedger(): ConsentLedgerEntry[] {
  return [
    {
      id: 'ledger-1',
      action: 'Verified',
      subject: 'PARA verifier',
      detail: 'Confirmed current civic policy can be mapped to proof-only app grants.',
      timestamp: 'Today · 09:12',
      app: 'PARA',
      surface: 'civic',
      outcome: 'Approved',
    },
    {
      id: 'ledger-2',
      action: 'Approved',
      subject: 'Atmos Dating beta',
      detail: 'Approved bounded compatibility and age claims without releasing raw provider data.',
      timestamp: 'Today · 09:30',
      app: 'Atmos Dating',
      surface: 'dating',
      outcome: 'Approved',
    },
    {
      id: 'ledger-3',
      action: 'Requested',
      subject: 'Townhall Civic',
      detail: 'Requested civic eligibility and PARA verification for a public-interest discussion flow.',
      timestamp: 'Today · 10:04',
      app: 'Townhall Civic',
      surface: 'public',
      outcome: 'Approved',
    },
    {
      id: 'ledger-4',
      action: 'Revoked',
      subject: 'Neighborhood wallet',
      detail: 'Revoked an older local proof flow after its audience and retention rules became unclear.',
      timestamp: 'Yesterday · 18:20',
      app: 'Neighborhood Wallet',
      surface: 'public',
      outcome: 'Revoked',
    },
  ]
}

export function buildConsentPolicy(): ConsentPolicy {
  return {
    title: 'Consent ledger rules',
    summary:
      'Apps request claims, not full profiles. Proof-only is the default for civic and political data, and every grant stays revocable.',
    rules: [
      {
        title: 'Minimum disclosure',
        detail:
          'Each grant is scoped to a surface and a short claim list. Raw identity data stays behind the broker.',
        effect: 'Default',
      },
      {
        title: 'Proof-only by default',
        detail:
          'Civic, political, and identity-affiliation requests resolve to proof-only grants unless the user explicitly widens the share mode later.',
        effect: 'Guardrail',
      },
      {
        title: 'User revocation wins',
        detail:
          'A revoked grant blocks future proof issuance and stops refreshes for the affected app.',
        effect: 'Stop',
      },
      {
        title: 'Expiry is expected',
        detail:
          'Most proof grants should age out and require a fresh review before the next access window.',
        effect: 'Audit',
      },
    ],
  }
}

export function buildProofLifecycleCopy(): ProofLifecycleCopy {
  return {
    title: 'Proof lifecycle',
    summary:
      'The app can show where a proof lives, when it expires, and how it can be revoked without leaking the raw identity record.',
    steps: [
      {
        id: 'request',
        title: 'Request a claim',
        detail: 'The app asks for a bounded statement, not the whole profile.',
        action: 'Review claim scope',
      },
      {
        id: 'review',
        title: 'Review the disclosure',
        detail: 'The broker explains what the app will learn and what stays private.',
        action: 'Check audience',
      },
      {
        id: 'approve',
        title: 'Approve the grant',
        detail: 'Consent is recorded with a surface, an audience, and an expiry.',
        action: 'Approve or deny',
      },
      {
        id: 'issue',
        title: 'Issue the proof',
        detail: 'The app receives a proof reference or verified result, not the raw record.',
        action: 'Attach proof',
      },
      {
        id: 'refresh',
        title: 'Refresh or expire',
        detail: 'Proofs can age out and be renewed before the next access window.',
        action: 'Renew access',
      },
      {
        id: 'revoke',
        title: 'Revoke access',
        detail: 'Revocation immediately blocks future proofs for new sessions.',
        action: 'Revoke now',
      },
    ],
  }
}

export function buildPdsSafetyPolicy(): PdsSafetyPolicy {
  return {
    title: 'PDS MOOver safety states',
    summary:
      'PDS safety stays separate from the profile surface. The broker can surface safety posture, migration risk, and proof degradation without exposing more identity data.',
    states: [
      {
        state: 'Backed up',
        summary: 'Backup and migration health are good.',
        proofImpact: 'Proofs can issue normally.',
        action: 'Keep monitoring',
        severity: 'Good',
      },
      {
        state: 'Enroll now',
        summary: 'No backup enrollment has been detected yet.',
        proofImpact: 'Long-lived grants should wait until backup is active.',
        action: 'Start backup',
        severity: 'Warning',
      },
      {
        state: 'Needs attention',
        summary: 'A backup exists, but follow-up work remains.',
        proofImpact: 'Issue proofs carefully and prompt a health review.',
        action: 'Review health',
        severity: 'Warning',
      },
      {
        state: 'Migrating',
        summary: 'The account is preparing for or in the middle of a move.',
        proofImpact: 'Fresh proofs may pause until the move completes.',
        action: 'Hold refreshes',
        severity: 'Warning',
      },
      {
        state: 'Proof degraded',
        summary: 'A verifier or provider is unavailable.',
        proofImpact: 'Fallback to manual review or retry the proof later.',
        action: 'Fallback to review',
        severity: 'Critical',
      },
      {
        state: 'Recovery paused',
        summary: 'Recovery has been intentionally paused by policy.',
        proofImpact: 'Do not issue new long-lived proofs until recovery resumes.',
        action: 'Resume recovery',
        severity: 'Critical',
      },
    ],
  }
}

export function buildClaimCatalog(): ClaimDescriptor[] {
  return [
    {
      type: 'is_verified_public_figure',
      label: 'Verified public figure',
      learns: 'The app learns a yes or no outcome backed by PARA, not the review materials.',
    },
    {
      type: 'is_civic_eligible',
      label: 'Civic eligibility',
      learns: 'The app learns that the account passed the civic check without seeing source documents.',
    },
    {
      type: 'has_para_verification',
      label: 'PARA verification',
      learns: 'The app learns whether PARA has issued a trusted verification outcome.',
    },
    {
      type: 'has_party_affiliation_match',
      label: 'Party affiliation match',
      learns: 'The app learns only a bounded match result, never the full values payload.',
    },
    {
      type: 'is_age_eligible',
      label: 'Age eligible',
      learns: 'The app learns whether the age gate passed, not the date of birth.',
    },
    {
      type: 'has_backup_coverage',
      label: 'Backup coverage',
      learns: 'The app learns whether the identity has portable recovery coverage in place.',
    },
  ]
}

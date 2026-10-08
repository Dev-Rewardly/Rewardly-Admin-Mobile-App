// One row of the approvals queue. Presentational only: every rule about WHO
// may decide and WHICH rows are decidable stays in app/(tabs)/approvals.tsx.
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { color, radius, space, type } from '@/constants/design';

interface Props {
  store: string;
  member: string;
  amount: string;
  date: string;
  status: string;
  /** Approve / Reject buttons. */
  showActions: boolean;
  /** "The earn gate decides" line instead of buttons. */
  showGate: boolean;
  /** This row's decision in flight, if any -- only that button says "Working…". */
  working: 'approve' | 'reject' | null;
  /** Any decision is in flight. */
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function ReceiptCard(p: Props) {
  const { t } = useTranslation();
  const subline = p.date ? `${p.member} · ${p.date}` : p.member;
  return (
    <View style={[styles.card, p.working !== null && styles.working]}>
      <View style={styles.row}>
        <Text style={styles.store} numberOfLines={1}>
          {p.store}
        </Text>
        <Text style={styles.amount} numberOfLines={1}>
          {p.amount}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.meta} numberOfLines={1}>
          {subline}
        </Text>
        <StatusPill status={p.status} />
      </View>

      {p.showActions && (
        <View style={styles.actions}>
          <Button
            label={p.working === 'reject' ? t('approvals.working') : t('approvals.reject')}
            accessibilityLabel={t('approvals.reject')}
            variant="destructiveQuiet"
            onPress={p.onReject}
            disabled={p.disabled}
            flex
          />
          <Button
            label={p.working === 'approve' ? t('approvals.working') : t('approvals.approve')}
            accessibilityLabel={t('approvals.approve')}
            onPress={p.onApprove}
            disabled={p.disabled}
            flex
          />
        </View>
      )}

      {p.showGate && (
        // Not a person's to decide. Saying why beats a dead button.
        <View style={styles.gate}>
          <Ionicons name="time-outline" size={15} color={color.textTertiary} />
          <Text style={styles.gateText}>{t('approvals.gate_decides')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.background,
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 6,
  },
  working: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  store: { ...type.headline, color: color.textPrimary, flexShrink: 1 },
  amount: { ...type.amount, color: color.textPrimary, flexShrink: 0 },
  meta: { ...type.meta, color: color.textSecondary, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  gate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  gateText: { ...type.caption, color: color.textSecondary, flex: 1 },
});

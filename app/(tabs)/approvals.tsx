// app/(tabs)/approvals.tsx
//
// The approvals queue, mirroring the web portal's Approvals screen.
//
// REDESIGN NOTE: only presentation changed. State, fetching, paging, the
// decide/409 handling, the reject-reason rule, role gating and the four-state
// split are the same code as before. New: account sheet (sign out moved behind
// the avatar), a confirmation toast after a decision, skeleton loading, and a
// full-screen failed state when a first load fails with nothing to show.
//
// WHAT IT MIRRORS, AND WHY EACH CHOICE IS THE PORTAL'S
//
//   Two tabs, Open and Decided, because they are different questions and so
//   they are different queries. Open is FIVE statuses (pending, processing,
//   flagged, under_review, info_requested) ordered OLDEST first -- the member
//   who has waited longest. Decided is everything else, NEWEST first.
//
//   Only `under_review` is a person's to decide. Every other open row shows
//   "the earn gate decides" instead of buttons.
//
// FOUR STATES, KEPT APART
//
//   loading / loaded-with-rows / loaded-and-empty / failed. Collapsing the last
//   two is how an outage reads as "nothing to approve".
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CoalitionHeader } from '@/components/CoalitionHeader';
import { ReceiptCard } from '@/components/ReceiptCard';
import { Avatar, initialsOf } from '@/components/ui/Avatar';
import { Banner } from '@/components/ui/Banner';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Toast } from '@/components/ui/Toast';
import { color, radius, space, type } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { useCoalition, useRetryCoalition } from '@/context/CoalitionContext';
import { ApiError } from '@/lib/api/client';
import { formatAmount } from '@/lib/api/coalition';
import {
  canDecide,
  decideReceipt,
  heldForReview,
  listReceipts,
  type Decision,
  type QueueTab,
  type ReceiptSummary,
} from '@/lib/api/approvals';

type Phase = 'loading' | 'loaded' | 'failed';

export default function Approvals() {
  const { t, i18n } = useTranslation();
  const { claims, getAccessToken, signOut } = useAuth();
  const coalition = useCoalition();
  const retryCoalition = useRetryCoalition();

  const [tab, setTab] = useState<QueueTab>('open');
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<ReceiptSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Which row, and WHICH decision, is in flight -- so only the button pressed
  // says "Working…" (a reject must not relabel Approve).
  const [deciding, setDeciding] = useState<{ id: string; decision: Decision } | null>(null);

  // Rejecting needs a reason: verification-api refuses a reject without one
  // (422), and it is the text the MEMBER is shown.
  const [rejecting, setRejecting] = useState<ReceiptSummary | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  // Presentation only.
  const [accountOpen, setAccountOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  const mayDecide = canDecide(claims?.roles);
  const who = claims?.name ?? claims?.email ?? '';

  const storeName = useCallback(
    (r: ReceiptSummary) => r.participant_name ?? r.merchant_name ?? t('approvals.unknown_merchant'),
    [t],
  );
  const amountOf = (r: ReceiptSummary) =>
    // The receipt's own currency when it names one; otherwise the coalition's.
    r.amount !== null
      ? formatAmount(r.amount, r.currency ?? coalition?.currency ?? null, i18n.language)
      : t('approvals.no_amount');

  const fetchPage = useCallback(
    async (which: number, whichTab: QueueTab, mode: 'replace' | 'append') => {
      const res = await listReceipts(getAccessToken, { page: which, tab: whichTab });
      setItems((cur) => (mode === 'replace' ? res.items : [...cur, ...res.items]));
      setTotal(res.total);
      setPage(which);
      setError(null);
      setPhase('loaded');
    },
    [getAccessToken],
  );

  const load = useCallback(
    async (whichTab: QueueTab) => {
      setPhase('loading');
      try {
        await fetchPage(1, whichTab, 'replace');
      } catch (err) {
        // A failure is NOT an empty queue.
        setError(messageFor(err, t));
        setPhase('failed');
      }
    },
    [fetchPage, t],
  );

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    retryCoalition();
    try {
      await fetchPage(1, tab, 'replace');
    } catch (err) {
      setError(messageFor(err, t));
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage, retryCoalition, tab, t]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, tab, 'append');
    } catch (err) {
      setError(messageFor(err, t));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore, page, tab, t]);

  const submit = useCallback(
    async (receipt: ReceiptSummary, decision: Decision, why?: string) => {
      setDeciding({ id: receipt.receipt_id, decision });
      try {
        await decideReceipt(getAccessToken, {
          receiptId: receipt.receipt_id,
          decision,
          reason: why,
          applyToSubmission: Boolean(receipt.submission_id),
        });
        setItems((cur) => cur.filter((r) => r.receipt_id !== receipt.receipt_id));
        setTotal((n) => (n === null ? null : Math.max(0, n - 1)));
        setError(null);
        setToast(
          t(decision === 'approve' ? 'approvals.toast_approved' : 'approvals.toast_rejected', {
            store: storeName(receipt),
          }),
        );
      } catch (err) {
        if (err instanceof ApiError && err.code === 'CONFLICT') {
          // Already decided by someone else while this list was open.
          setItems((cur) => cur.filter((r) => r.receipt_id !== receipt.receipt_id));
          setTotal((n) => (n === null ? null : Math.max(0, n - 1)));
          setError(t('approvals.already_decided'));
        } else {
          setError(messageFor(err, t));
        }
      } finally {
        setDeciding(null);
      }
    },
    [getAccessToken, storeName, t],
  );

  const confirmReject = useCallback(async () => {
    const target = rejecting;
    if (!target) return;
    if (reason.trim() === '') {
      setReasonError(t('approvals.reject_required'));
      return;
    }
    const why = reason.trim();
    setRejecting(null);
    setReason('');
    setReasonError(null);
    await submit(target, 'reject', why);
  }, [rejecting, reason, submit, t]);

  const hasMore = total !== null && items.length < total;
  // A failed first load with nothing to show gets the full-screen failed state;
  // the banner would only repeat it.
  const failedEmpty = phase === 'failed' && items.length === 0;

  const listHeader = (
    <View style={styles.listHeader}>
      {error !== null && !failedEmpty && <Banner tone="error" message={error} />}
      {total !== null && items.length > 0 && (
        <Text style={styles.count}>{t('approvals.showing', { shown: items.length, total })}</Text>
      )}
      {/* Held declarations are part of the web Open queue and cannot be decided
          from a phone. Saying so beats omitting them silently. */}
      {tab === 'open' && !failedEmpty && <Banner tone="info" message={t('approvals.held_note')} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <CoalitionHeader />
          <Avatar
            initials={initialsOf(who)}
            onPress={() => setAccountOpen(true)}
            accessibilityLabel={t('approvals.account_open')}
          />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t('approvals.title')}
        </Text>
        <SegmentedControl
          options={[
            { id: 'open', label: t('approvals.tab_open') },
            { id: 'decided', label: t('approvals.tab_decided') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <View style={styles.body}>
        {phase === 'loading' ? (
          <Skeleton label={t('approvals.working')} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(r) => r.receipt_id}
            contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.list}
            ListHeaderComponent={listHeader}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.brand} colors={[color.brand]} />
            }
            ListEmptyComponent={
              phase === 'loaded' ? (
                <EmptyState
                  icon="checkmark"
                  tone="success"
                  message={tab === 'open' ? t('approvals.empty') : t('approvals.empty_decided')}
                />
              ) : failedEmpty ? (
                <EmptyState
                  icon="alert-circle-outline"
                  tone="error"
                  message={error ?? t('approvals.err_generic')}
                  hint={t('approvals.pull_to_retry')}
                  live
                />
              ) : null
            }
            ListFooterComponent={
              hasMore ? (
                <Button
                  label={loadingMore ? t('approvals.working') : t('approvals.load_more')}
                  accessibilityLabel={t('approvals.load_more')}
                  variant="secondary"
                  size="lg"
                  onPress={() => void loadMore()}
                  disabled={loadingMore}
                  style={styles.more}
                />
              ) : null
            }
            ItemSeparatorComponent={Gap}
            renderItem={({ item }) => {
              const held = heldForReview(item.status);
              const decidable = mayDecide && tab === 'open';
              return (
                <ReceiptCard
                  store={storeName(item)}
                  member={item.consumer_name ?? t('approvals.unknown_member')}
                  amount={amountOf(item)}
                  date={item.submitted_at ? shortDate(item.submitted_at, i18n.language) : ''}
                  status={item.status}
                  showActions={decidable && held}
                  showGate={decidable && !held}
                  working={deciding?.id === item.receipt_id ? deciding.decision : null}
                  disabled={deciding !== null}
                  onApprove={() => void submit(item, 'approve')}
                  onReject={() => {
                    setReason('');
                    setReasonError(null);
                    setRejecting(item);
                  }}
                />
              );
            }}
          />
        )}
        <Toast message={toast} onHide={hideToast} />
      </View>

      {/* Reject: reason required, written for the member. */}
      <BottomSheet
        visible={rejecting !== null}
        onClose={() => setRejecting(null)}
        accessibilityLabel={t('approvals.reject_title')}
      >
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {t('approvals.reject_title')}
          </Text>
          <Text style={styles.sheetHint}>{t('approvals.reject_hint')}</Text>
        </View>
        {rejecting && (
          <View style={styles.summary}>
            <View style={styles.summaryText}>
              <Text style={styles.summaryStore} numberOfLines={1}>
                {storeName(rejecting)}
              </Text>
              <Text style={styles.summaryMeta} numberOfLines={1}>
                {rejecting.consumer_name ?? t('approvals.unknown_member')}
                {rejecting.submitted_at ? ` · ${shortDate(rejecting.submitted_at, i18n.language)}` : ''}
              </Text>
            </View>
            <Text style={styles.summaryAmount}>{amountOf(rejecting)}</Text>
          </View>
        )}
        <View style={styles.fieldWrap}>
          <TextInput
            value={reason}
            onChangeText={(v) => {
              setReason(v);
              if (reasonError) setReasonError(null);
            }}
            placeholder={t('approvals.reject_placeholder')}
            placeholderTextColor={color.textTertiary}
            multiline
            style={[styles.input, reasonError !== null && styles.inputInvalid]}
            accessibilityLabel={t('approvals.reject_title')}
            maxLength={1000}
            autoFocus
          />
          {reasonError !== null && (
            <View style={styles.inputErrorRow} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle-outline" size={14} color={color.error} />
              <Text style={styles.inputError}>{reasonError}</Text>
            </View>
          )}
        </View>
        <View style={styles.sheetActions}>
          <Button label={t('approvals.cancel')} variant="secondary" size="lg" onPress={() => setRejecting(null)} flex />
          <Button
            label={t('approvals.confirm_reject')}
            variant="destructive"
            size="lg"
            onPress={() => void confirmReject()}
            flex
          />
        </View>
      </BottomSheet>

      {/* Account: who is signed in, the coalition, and sign out. */}
      <BottomSheet
        visible={accountOpen}
        onClose={() => setAccountOpen(false)}
        accessibilityLabel={t('approvals.account')}
      >
        <View style={styles.accountRow}>
          <Avatar initials={initialsOf(who)} size={48} />
          <View style={styles.summaryText}>
            {claims?.name ? (
              <Text style={styles.accountName} numberOfLines={1}>
                {claims.name}
              </Text>
            ) : null}
            {claims?.email ? (
              <Text style={styles.summaryMeta} numberOfLines={1}>
                {claims.email}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.summary}>
          <CoalitionHeader />
        </View>
        <Button
          label={t('approvals.sign_out')}
          variant="destructiveQuiet"
          size="lg"
          onPress={() => {
            setAccountOpen(false);
            void signOut();
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

function Skeleton({ label }: { label: string }) {
  return (
    <View style={styles.list} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.skelCard, i > 0 && styles.gap]}>
          <View style={styles.skelRow}>
            <View style={[styles.skelBar, { width: 140 }]} />
            <View style={[styles.skelBar, { width: 56 }]} />
          </View>
          <View style={[styles.skelBar, styles.skelSoft, { width: 180, height: 12 }]} />
          <View style={styles.skelRow}>
            <View style={[styles.skelBtn, styles.skelSoft]} />
            <View style={[styles.skelBtn, styles.skelSoft]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyState({
  icon,
  tone,
  message,
  hint,
  live,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone: 'success' | 'error';
  message: string;
  hint?: string;
  live?: boolean;
}) {
  const ok = tone === 'success';
  return (
    <View style={styles.empty} accessibilityLiveRegion={live ? 'polite' : 'none'}>
      <View style={[styles.emptyIcon, { backgroundColor: ok ? color.successSurface : color.errorSurface }]}>
        <Ionicons name={icon} size={24} color={ok ? color.success : color.error} />
      </View>
      <Text style={styles.emptyText}>{message}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

/** Date only. A queue does not need a clock, and a long string wraps on a phone. */
function shortDate(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d.toLocaleDateString();
  }
}

function messageFor(err: unknown, t: (k: string) => string): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'NO_SESSION':
      case 'UNAUTHORIZED':
        return t('approvals.err_signed_out');
      case 'FORBIDDEN':
        return t('approvals.err_forbidden');
      case 'REASON_REQUIRED':
        return t('approvals.reject_required');
      case 'OFFLINE':
        return t('approvals.err_offline');
      case 'TIMEOUT':
        return t('approvals.err_timeout');
      default:
        return t('approvals.err_generic');
    }
  }
  return t('approvals.err_generic');
}

const H = space.xl - 4; // 20pt screen gutter

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  header: { paddingHorizontal: H, paddingTop: space.sm - 2, paddingBottom: space.md, gap: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { ...type.largeTitle, color: color.textPrimary },
  body: { flex: 1, borderTopWidth: 1, borderTopColor: color.divider },

  listHeader: { gap: 10, paddingBottom: space.md },
  count: { ...type.caption, color: color.textSecondary, fontVariant: ['tabular-nums'] },
  list: { paddingHorizontal: H, paddingTop: space.md, paddingBottom: space.xxl },
  emptyWrap: { flexGrow: 1, paddingHorizontal: H, paddingTop: space.md },
  gap: { height: space.md },
  more: { marginTop: space.lg },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: space.xxl },
  emptyIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.bodySmall, color: color.textBody, textAlign: 'center' },
  emptyHint: { ...type.caption, color: color.textSecondary, textAlign: 'center' },

  skelCard: { borderWidth: 1, borderColor: color.skeleton, borderRadius: radius.lg, padding: space.lg, gap: 10 },
  skelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  skelBar: { height: 14, borderRadius: 4, backgroundColor: color.skeleton },
  skelSoft: { backgroundColor: color.surface },
  skelBtn: { flex: 1, height: 44, borderRadius: 11, marginTop: 6 },

  sheetHead: { gap: 6 },
  sheetTitle: { ...type.sheetTitle, color: color.textPrimary },
  sheetHint: { ...type.label, fontFamily: type.body.fontFamily, color: color.textSecondary },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  summaryText: { flex: 1, gap: 2 },
  summaryStore: { ...type.label, fontFamily: type.headline.fontFamily, color: color.textPrimary },
  summaryMeta: { ...type.caption, color: color.textSecondary },
  summaryAmount: { ...type.amount, fontSize: 14, color: color.textPrimary },
  fieldWrap: { gap: space.sm },
  input: {
    minHeight: 104,
    borderWidth: 1.5,
    borderColor: color.brand,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingTop: space.md,
    paddingBottom: space.md,
    textAlignVertical: 'top',
    ...type.body,
    color: color.textPrimary,
  },
  inputInvalid: { borderColor: color.error },
  inputErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputError: { ...type.caption, color: color.error },
  sheetActions: { flexDirection: 'row', gap: 10 },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accountName: { ...type.headline, color: color.textPrimary },
});

// app/(tabs)/approvals.tsx
//
// The approvals queue, mirroring the web portal's Approvals screen.
//
// WHAT IT MIRRORS, AND WHY EACH CHOICE IS THE PORTAL'S
//
//   Two tabs, Open and Decided, because they are different questions and so
//   they are different queries. Open is FIVE statuses (pending, processing,
//   flagged, under_review, info_requested) ordered OLDEST first -- the member
//   who has waited longest. Decided is everything else, NEWEST first, because
//   it is a record being searched rather than a queue being worked.
//
//   Only `under_review` is a person's to decide. Every other open row shows
//   "the earn gate decides" instead of buttons, because offering a decision
//   the service refuses is worse than offering none.
//
// FOUR STATES, KEPT APART
//
//   loading / loaded-with-rows / loaded-and-empty / failed. The last two are
//   the ones that get collapsed, and collapsing them is how an outage reads as
//   "nothing to approve" -- an admin closes the app believing the queue is
//   clear.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AdminBadge } from '@/components/AdminBadge';
import { color, radius, space, type } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api/client';
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
  const { t } = useTranslation();
  const { claims, getAccessToken, signOut } = useAuth();

  const [tab, setTab] = useState<QueueTab>('open');
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<ReceiptSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);

  // Rejecting needs a reason: verification-api refuses a reject without one
  // (422), and it is the text the MEMBER is shown.
  const [rejecting, setRejecting] = useState<ReceiptSummary | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const mayDecide = canDecide(claims?.roles);

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
    try {
      await fetchPage(1, tab, 'replace');
    } catch (err) {
      setError(messageFor(err, t));
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage, tab, t]);

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
      setDeciding(receipt.receipt_id);
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
      } catch (err) {
        if (err instanceof ApiError && err.code === 'CONFLICT') {
          // Already decided by someone else while this list was open. Not a
          // failure to report -- it is done.
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
    [getAccessToken, t],
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <AdminBadge />
          <Pressable
            onPress={() => void signOut()}
            style={styles.signOut}
            accessibilityRole="button"
            accessibilityLabel={t('approvals.sign_out')}
            hitSlop={8}
          >
            <Text style={styles.signOutText}>{t('approvals.sign_out')}</Text>
          </Pressable>
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {t('approvals.title')}
        </Text>

        <View style={styles.tabs}>
          {(['open', 'decided'] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.tab, tab === id && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === id }}
              accessibilityLabel={t(`approvals.tab_${id}`)}
            >
              <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>
                {t(`approvals.tab_${id}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {total !== null && items.length > 0 && (
          <Text style={styles.count}>
            {t('approvals.showing', { shown: items.length, total })}
          </Text>
        )}
      </View>

      {error !== null && (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      )}

      {/* Held declarations are part of the web Open queue and cannot be decided
          from a phone (that route needs a service token as well as the user's).
          Saying so beats omitting them silently -- an admin would otherwise
          work a queue they believe is complete. */}
      {tab === 'open' && phase !== 'loading' && (
        <Text style={styles.note}>{t('approvals.held_note')}</Text>
      )}

      {phase === 'loading' ? (
        <View style={styles.centre}>
          <ActivityIndicator color={color.brand} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.receipt_id}
          contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.brand} />
          }
          ListEmptyComponent={
            phase === 'loaded' ? (
              <Text style={styles.empty}>
                {tab === 'open' ? t('approvals.empty') : t('approvals.empty_decided')}
              </Text>
            ) : null
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable
                onPress={() => void loadMore()}
                disabled={loadingMore}
                style={[styles.more, loadingMore && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel={t('approvals.load_more')}
              >
                <Text style={styles.moreText}>
                  {loadingMore ? t('approvals.working') : t('approvals.load_more')}
                </Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            const held = heldForReview(item.status);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {item.participant_name ?? item.merchant_name ?? t('approvals.unknown_merchant')}
                  </Text>
                  <StatusPill status={item.status} />
                </View>

                <Text style={styles.meta} numberOfLines={1}>
                  {item.consumer_name ?? t('approvals.unknown_member')}
                </Text>
                <Text style={styles.meta}>
                  {item.amount !== null
                    ? `${item.currency ?? ''}${item.amount}`
                    : t('approvals.no_amount')}
                  {item.submitted_at ? ` · ${shortDate(item.submitted_at)}` : ''}
                </Text>

                {mayDecide &&
                  tab === 'open' &&
                  (held ? (
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => void submit(item, 'approve')}
                        disabled={deciding !== null}
                        style={[styles.action, styles.approve, deciding !== null && styles.disabled]}
                        accessibilityRole="button"
                        accessibilityLabel={t('approvals.approve')}
                      >
                        <Text style={styles.approveText}>
                          {deciding === item.receipt_id
                            ? t('approvals.working')
                            : t('approvals.approve')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setReason('');
                          setReasonError(null);
                          setRejecting(item);
                        }}
                        disabled={deciding !== null}
                        style={[styles.action, styles.reject, deciding !== null && styles.disabled]}
                        accessibilityRole="button"
                        accessibilityLabel={t('approvals.reject')}
                      >
                        <Text style={styles.rejectText}>{t('approvals.reject')}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    // Not a person's to decide. Saying why beats a dead button.
                    <Text style={styles.gate}>{t('approvals.gate_decides')}</Text>
                  ))}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={rejecting !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejecting(null)}
      >
        <View style={styles.scrim}>
          <ScrollView contentContainerStyle={styles.scrimInner} keyboardShouldPersistTaps="handled">
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                {t('approvals.reject_title')}
              </Text>
              <Text style={styles.sheetHint}>{t('approvals.reject_hint')}</Text>
              <TextInput
                value={reason}
                onChangeText={(v) => {
                  setReason(v);
                  if (reasonError) setReasonError(null);
                }}
                placeholder={t('approvals.reject_placeholder')}
                placeholderTextColor={color.textTertiary}
                multiline
                style={styles.input}
                accessibilityLabel={t('approvals.reject_title')}
                maxLength={1000}
                autoFocus
              />
              {reasonError !== null && (
                <Text style={styles.inputError} accessibilityLiveRegion="polite">
                  {reasonError}
                </Text>
              )}
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={() => setRejecting(null)}
                  style={[styles.action, styles.cancel]}
                  accessibilityRole="button"
                  accessibilityLabel={t('approvals.cancel')}
                >
                  <Text style={styles.cancelText}>{t('approvals.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void confirmReject()}
                  style={[styles.action, styles.reject]}
                  accessibilityRole="button"
                  accessibilityLabel={t('approvals.confirm_reject')}
                >
                  <Text style={styles.rejectText}>{t('approvals.confirm_reject')}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  // An unrecognised status is shown as itself rather than hidden or guessed:
  // one this build has not been taught about is still a fact about the row.
  const key = `approvals.status_${status}`;
  const label = t(key);
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label === key ? status : label}</Text>
    </View>
  );
}

/** Date only. A queue does not need a clock, and a long string wraps on a phone. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signOut: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  signOutText: { ...type.label, color: color.brand },
  title: { ...type.title, color: color.textPrimary },
  tabs: { flexDirection: 'row', gap: space.sm },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  tabOn: { backgroundColor: color.brand, borderColor: color.brand },
  tabText: { ...type.label, color: color.textSecondary },
  tabTextOn: { color: color.onBrand },
  count: { ...type.caption, color: color.textSecondary },
  note: {
    ...type.caption,
    color: color.textSecondary,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  list: { padding: space.lg, gap: space.md },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  empty: { ...type.body, color: color.textSecondary, textAlign: 'center' },
  banner: {
    backgroundColor: color.errorSurface,
    borderColor: color.error,
    borderWidth: 1,
    borderRadius: radius.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
  },
  bannerText: { ...type.caption, color: color.error },
  card: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  merchant: { ...type.label, color: color.textPrimary, flexShrink: 1 },
  meta: { ...type.caption, color: color.textSecondary },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  pillText: { ...type.caption, color: color.textSecondary },
  gate: { ...type.caption, color: color.textTertiary, marginTop: space.sm, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  action: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  approve: { backgroundColor: color.brand, borderColor: color.brand },
  approveText: { ...type.label, color: color.onBrand },
  reject: { backgroundColor: color.background, borderColor: color.error },
  rejectText: { ...type.label, color: color.error },
  cancel: { backgroundColor: color.background, borderColor: color.border },
  cancelText: { ...type.label, color: color.textSecondary },
  disabled: { opacity: 0.5 },
  more: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    marginTop: space.md,
  },
  moreText: { ...type.label, color: color.brand },
  scrim: { flex: 1, backgroundColor: '#0F172A99' },
  scrimInner: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
  },
  sheetTitle: { ...type.title, color: color.textPrimary },
  sheetHint: { ...type.caption, color: color.textSecondary },
  input: {
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 96,
    textAlignVertical: 'top',
    ...type.body,
    color: color.textPrimary,
  },
  inputError: { ...type.caption, color: color.error },
  sheetActions: { flexDirection: 'row', gap: space.md },
});

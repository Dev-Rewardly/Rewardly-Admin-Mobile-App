// app/(tabs)/dashboard.tsx
//
// The coalition at a glance: the short version of the portal's dashboard
// (agreed 2026-10-08). Four sections an admin checks in seconds --
//
//   Needs attention · Today · Reward pool · Recent activity
//
// -- read from the same upstream routes, with the same rules (lib/dashboard/*
// are ports of the portal's), so the phone and the web never disagree. The
// trends chart, rewards as % of sales and promotions ending soon stay on the
// web.
//
// Every box has three states and keeps them apart: loading (placeholders),
// loaded, and couldn't-load. A box never shows 0 for "not known yet" -- that
// is how a dashboard says "all clear" during an outage.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CoalitionHeader } from '@/components/CoalitionHeader';
import { Avatar, initialsOf } from '@/components/ui/Avatar';
import { color, font, hit, radius, space, type } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { useCoalition, useRetryCoalition } from '@/context/CoalitionContext';
import { useDashboard } from '@/hooks/useDashboard';
import { formatAmount } from '@/lib/api/coalition';
import { relativeAge, visibleActivity } from '@/lib/dashboard/activity';
import { stripState, type AttentionSource, type AttentionTone } from '@/lib/dashboard/attention';
import { estimateRunway, runwayLabel, runwayNote } from '@/lib/dashboard/runway';
import { attentionSources } from '@/lib/dashboard/sources';

/** Rows of Recent activity on the phone; the portal's feed holds 20. */
const ACTIVITY_ROWS = 5;

/** Sources that are Approvals work open the Approvals tab when tapped. */
const OPENS_APPROVALS = new Set(['approvals', 'flagged', 'approvals_late', 'duplicates']);

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { claims, signOut } = useAuth();
  const coalition = useCoalition();
  const retryCoalition = useRetryCoalition();
  const { data, refreshing, refresh } = useDashboard();
  const who = claims?.name ?? claims?.email ?? '';
  const currency = coalition?.currency ?? null;

  const n = (v: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(v);
  const money = (v: number) => formatAmount(v, currency, i18n.language);

  const onRefresh = () => {
    retryCoalition();
    void refresh();
  };

  const asOf = data.asOf
    ? t('dashboard.as_of', {
        time: data.asOf.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' }),
      })
    : t('dashboard.reading');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.brand} colors={[color.brand]} />
        }
      >
        <View style={styles.header}>
          <CoalitionHeader />
          <Text style={styles.title} accessibilityRole="header">
            {t('dashboard.title')}
          </Text>
          <Text style={styles.asOf}>{asOf}</Text>
        </View>

        <View style={styles.body}>
          <Section title={t('dashboard.attention.title')}>
            <Attention sources={attentionSources(data)} />
          </Section>

          <Section title={t('dashboard.today.title')}>
            <Today data={data} n={n} money={money} />
          </Section>

          <Pool data={data} money={money} />

          <Section title={t('dashboard.activity.title')}>
            <Activity data={data} n={n} />
          </Section>

          <View style={styles.card}>
            {who !== '' && (
              <View style={styles.who} accessible accessibilityLabel={t('dashboard.signed_in_as', { who })}>
                <Avatar initials={initialsOf(who)} />
                <View style={styles.whoText}>
                  <Text style={styles.whoLabel}>{t('dashboard.signed_in_label')}</Text>
                  <Text style={styles.whoName} numberOfLines={1}>
                    {who}
                  </Text>
                </View>
              </View>
            )}
            <Pressable
              onPress={() => signOut()}
              style={({ pressed }) => [styles.signOut, who !== '' && styles.divided, pressed && styles.pressedDanger]}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.sign_out')}
            >
              <Text style={styles.signOutText}>{t('dashboard.sign_out')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Needs attention ──────────────────────────────────────────────────────────

function Attention({ sources }: { sources: AttentionSource[] }) {
  const { t } = useTranslation();
  const strip = stripState(sources);
  const labelOf = (s: AttentionSource) => t(`dashboard.attention_label.${s.id}`);

  if (strip.kind === 'loading') return <Placeholder rows={3} />;

  if (strip.kind === 'all-clear') {
    return (
      <View style={[styles.card, styles.clearRow]}>
        <View style={styles.clearTick}>
          <Ionicons name="checkmark" size={18} color={color.success} />
        </View>
        <Text style={styles.clearText}>{t('dashboard.attention.all_clear')}</Text>
      </View>
    );
  }

  if (strip.kind === 'unavailable') {
    return <Failed message={t('dashboard.attention.couldnt_check_any')} />;
  }

  return (
    <View style={styles.card}>
      {strip.items.map((s, i) => {
        const count = s.count.state === 'ok' ? s.count.value : 0;
        const oldest =
          s.oldestDays?.state === 'ok' && s.oldestDays.value !== null
            ? s.oldestDays.value < 1
              ? t('dashboard.attention.oldest_today')
              : t('dashboard.attention.oldest_days', { count: s.oldestDays.value })
            : null;
        const opens = OPENS_APPROVALS.has(s.id);
        const row = (
          <>
            <Pip tone={s.tone} />
            <Text style={styles.attCount}>{count}</Text>
            <View style={styles.attText}>
              <Text style={styles.attLabel}>{labelOf(s)}</Text>
              {oldest && <Text style={styles.attMeta}>{oldest}</Text>}
            </View>
            {opens && <Ionicons name="chevron-forward" size={18} color={color.textTertiary} />}
          </>
        );
        return opens ? (
          <Pressable
            key={s.id}
            onPress={() => router.navigate('/approvals')}
            style={({ pressed }) => [styles.attRow, i > 0 && styles.divided, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${count} ${labelOf(s)}${oldest ? `, ${oldest}` : ''}`}
          >
            {row}
          </Pressable>
        ) : (
          <View
            key={s.id}
            style={[styles.attRow, i > 0 && styles.divided]}
            accessible
            accessibilityLabel={`${count} ${labelOf(s)}`}
          >
            {row}
          </View>
        );
      })}
      {strip.unreachable.length > 0 && (
        // Known work outranks it, but what could not be checked is still said.
        <View style={[styles.attRow, styles.divided]}>
          <Ionicons name="alert-circle-outline" size={16} color={color.textSecondary} />
          <Text style={styles.attMeta}>
            {t('dashboard.attention.couldnt_check', { what: strip.unreachable.map(labelOf).join(', ') })}
          </Text>
        </View>
      )}
    </View>
  );
}

function Pip({ tone }: { tone: AttentionTone }) {
  return <View style={[styles.pip, tone === 'error' ? styles.pipError : tone === 'warning' ? styles.pipWarning : styles.pipNeutral]} />;
}

// ── Today ────────────────────────────────────────────────────────────────────

type Data = ReturnType<typeof useDashboard>['data'];

function Today({ data, n, money }: { data: Data; n: (v: number) => string; money: (v: number) => string }) {
  const { t } = useTranslation();
  const a = data.analytics;
  if (a.state === 'loading') return <Placeholder rows={4} />;
  // The server answers today: null when it could not compute it. Unknown, not 0.
  if (a.state === 'unavailable' || a.value.today === null) return <Failed message={t('dashboard.failed')} />;

  const today = a.value.today;
  const fresh = data.newMembers.state === 'ok' ? n(data.newMembers.value.today) : '—';
  // A zero GMV beside points issued is an empty aggregate, not a quiet day.
  const gmvNote = today.gmv === 0 && today.pointsIssued > 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.groupLabel}>{t('dashboard.today.activity')}</Text>
        <View style={styles.metrics}>
          <Metric label={t('dashboard.today.points')} value={n(today.pointsIssued)} />
          <Metric label={t('dashboard.today.redemptions')} value={n(today.pointsRedeemed)} />
          <Metric label={t('dashboard.today.gmv')} value={today.gmv > 0 ? money(today.gmv) : '—'} />
        </View>
        {gmvNote && <Text style={styles.note}>{t('dashboard.today.gmv_note')}</Text>}
      </View>
      <View style={[styles.cardRow, styles.divided]}>
        <Text style={styles.groupLabel}>{t('dashboard.today.members')}</Text>
        <View style={styles.metrics}>
          <Metric label={t('dashboard.today.active')} value={n(today.membersActive)} />
          <Metric label={t('dashboard.today.new')} value={fresh} />
          <View style={styles.metric} />
        </View>
      </View>
    </View>
  );
}

// ── Reward pool ──────────────────────────────────────────────────────────────

function Pool({ data, money }: { data: Data; money: (v: number) => string }) {
  const { t } = useTranslation();
  const c = data.coverage;
  const band = c.state === 'ok' ? c.value.band : null;

  let content: React.ReactNode;
  if (c.state === 'loading') content = <Placeholder rows={3} />;
  else if (c.state === 'unavailable') content = <Failed message={t('dashboard.pool.failed')} />;
  else {
    // Runway divides the pool THIS card shows by the reward cost per day, both
    // money -- the portal's rule (lib/dashboard/runway.ts).
    //
    // It needs the earn series and the point rate as well as the pool, and the
    // pool usually lands first. Estimating before they arrive would print
    // "no points have been issued yet" over a live programme, so until both
    // have settled the runway says it is still being worked out.
    const a = data.analytics;
    const r = data.baseRate;
    let label: { key: string; days?: number };
    let note: { key: string; count?: number };
    if (a.state === 'loading' || r.state === 'loading') {
      label = runwayLabel(null);
      note = { key: 'dashboard.runway.note_reading' };
    } else if (a.state === 'unavailable') {
      label = runwayLabel(null);
      note = { key: 'dashboard.runway.note_missing' };
    } else {
      const runway = estimateRunway(
        c.value.poolBalance,
        a.value.earnSeries,
        a.value.today?.pointsIssued ?? null,
        r.state === 'ok' ? r.value : null,
      );
      label = runwayLabel(runway.days);
      // An unreadable rate is not "this coalition has no point rate set".
      note =
        r.state === 'unavailable' && runway.basis === 'unvalued'
          ? { key: 'dashboard.runway.note_missing' }
          : runwayNote(runway);
    }
    content = (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.metrics}>
            {/* Exact, with cents, on both: these two are read against each other. */}
            <Metric label={t('dashboard.pool.pool')} value={money(c.value.poolBalance)} wide />
            <Metric label={t('dashboard.pool.owed')} value={money(c.value.liability)} wide />
          </View>
        </View>
        <View style={[styles.cardRow, styles.divided]}>
          <View style={styles.runwayRow}>
            <Text style={styles.metricLabel}>{t('dashboard.pool.runway')}</Text>
            <Text style={styles.metricValue}>{t(label.key, { days: label.days })}</Text>
          </View>
          <Text style={styles.note}>{t(note.key, { count: note.count })}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t('dashboard.pool.title')}</Text>
        {band && (
          <View style={[styles.band, band === 'healthy' ? styles.bandOk : styles.bandBad]}>
            <View style={[styles.bandDot, { backgroundColor: band === 'healthy' ? color.success : color.error }]} />
            <Text style={[styles.bandText, { color: band === 'healthy' ? color.success : color.error }]}>
              {t(`dashboard.pool.band_${band}`)}
            </Text>
          </View>
        )}
      </View>
      {content}
    </View>
  );
}

// ── Recent activity ──────────────────────────────────────────────────────────

function Activity({ data, n }: { data: Data; n: (v: number) => string }) {
  const { t } = useTranslation();
  const a = data.analytics;
  if (a.state === 'loading') return <Placeholder rows={4} />;
  if (a.state === 'unavailable') return <Failed message={t('dashboard.failed')} />;

  const rows = visibleActivity(a.value.recentActivity, ACTIVITY_ROWS);
  if (rows.length === 0) {
    return (
      <View style={[styles.card, styles.cardRow]}>
        <Text style={styles.note}>{t('dashboard.activity.empty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {rows.map((r, i) => {
        const age = relativeAge(r.at);
        const earn = r.kind === 'earn';
        return (
          <View key={`${r.kind}-${r.id}`} style={[styles.actRow, i > 0 && styles.divided]} accessible>
            <Text style={[styles.actPts, earn ? styles.actEarn : styles.actRedeem]}>
              {t(earn ? 'dashboard.activity.earn' : 'dashboard.activity.redeem', { points: n(r.points) })}
            </Text>
            <Text style={styles.actStore} numberOfLines={1}>
              {r.participant}
            </Text>
            <Text style={styles.actWhen}>{age ? t(age.key, { count: age.count }) : ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Metric({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.metric, wide && styles.metricWide]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
    </View>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <View style={[styles.card, styles.failed]} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={18} color={color.error} />
      <Text style={styles.failedText}>{message}</Text>
    </View>
  );
}

function Placeholder({ rows }: { rows: number }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, styles.skel]} accessible accessibilityRole="progressbar" accessibilityLabel={t('dashboard.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.skelBar, i % 2 === 1 && styles.skelSoft, { width: `${[70, 45, 85, 55][i % 4]}%` }]} />
      ))}
    </View>
  );
}

const H = space.xl - 4;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  scroll: { paddingBottom: H },
  header: { paddingHorizontal: H, paddingTop: space.sm - 2, paddingBottom: space.md, gap: 14 },
  title: { ...type.largeTitle, color: color.textPrimary },
  asOf: { ...type.caption, color: color.textSecondary, marginTop: -6 },
  body: {
    paddingHorizontal: H,
    paddingTop: space.lg,
    gap: 22,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },

  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  sectionTitle: { ...type.micro, letterSpacing: 0.7, textTransform: 'uppercase', color: color.textSecondary },

  card: { borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.background },
  cardRow: { paddingVertical: 13, paddingHorizontal: space.lg, gap: 10 },
  divided: { borderTopWidth: 1, borderTopColor: color.divider },
  pressed: { backgroundColor: color.surface },
  note: { ...type.caption, color: color.textSecondary },

  attRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 13, paddingHorizontal: space.lg },
  attCount: { fontFamily: font.mono, fontSize: 15, lineHeight: 22, minWidth: 22, color: color.textPrimary },
  attText: { flex: 1, gap: 2 },
  attLabel: { ...type.bodySmall, color: color.textBody },
  attMeta: { ...type.caption, color: color.textSecondary, flex: 1 },
  pip: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  pipError: { backgroundColor: color.error },
  pipWarning: { backgroundColor: color.warning },
  pipNeutral: { borderWidth: 1.5, borderColor: color.textTertiary },

  clearRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg },
  clearTick: { width: 30, height: 30, borderRadius: 9, backgroundColor: color.successSurface, alignItems: 'center', justifyContent: 'center' },
  clearText: { ...type.bodySmall, color: color.textBody, flex: 1 },

  groupLabel: { fontFamily: font.semibold, fontSize: 13, color: color.textPrimary },
  metrics: { flexDirection: 'row', gap: space.md },
  metric: { flex: 1, gap: 3, minWidth: 0 },
  metricWide: { flex: 1 },
  metricLabel: { ...type.caption, color: color.textSecondary },
  metricValue: { ...type.amount, fontSize: 19, lineHeight: 26, color: color.textPrimary },
  runwayRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },

  band: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: space.sm, paddingRight: 9, paddingVertical: 3, borderRadius: radius.pill },
  bandOk: { backgroundColor: color.successSurface },
  bandBad: { backgroundColor: color.errorSurface },
  bandDot: { width: 6, height: 6, borderRadius: 3 },
  bandText: { ...type.micro },

  actRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg },
  actPts: { fontFamily: font.mono, fontSize: 14, minWidth: 76 },
  actEarn: { color: color.success },
  actRedeem: { color: color.textPrimary },
  actStore: { ...type.label, color: color.textPrimary, flex: 1 },
  actWhen: { ...type.caption, color: color.textSecondary },

  failed: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14, paddingHorizontal: space.lg, backgroundColor: color.errorSurface, borderColor: color.errorSurface },
  failedText: { ...type.meta, color: color.errorText, flex: 1 },

  skel: { padding: space.lg, gap: space.md },
  skelBar: { height: 13, borderRadius: 4, backgroundColor: color.skeleton },
  skelSoft: { backgroundColor: color.surface },

  who: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: space.lg },
  whoText: { flex: 1, gap: 2 },
  whoLabel: { ...type.caption, color: color.textSecondary },
  whoName: { ...type.headline, color: color.textPrimary },
  signOut: { minHeight: hit.comfortable, alignItems: 'center', justifyContent: 'center' },
  pressedDanger: { backgroundColor: color.errorHover },
  signOutText: { ...type.button, color: color.error },
});

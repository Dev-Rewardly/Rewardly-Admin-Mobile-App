// Which coalition this admin is working in, above everything else -- the
// portal shows it in its sidebar for the same reason: an approval is always
// made on behalf of one coalition.
//
//   Bishop Ranch
//   [ADMIN] Americas
//
// Until the coalition loads (or if it never does) only the Admin marker shows,
// exactly as before, rather than a placeholder name.
import { StyleSheet, Text, View } from 'react-native';

import { AdminBadge } from '@/components/AdminBadge';
import { color, font, space, type } from '@/constants/design';
import { useCoalition } from '@/context/CoalitionContext';

export function CoalitionHeader({ align = 'start' }: { align?: 'start' | 'center' }) {
  const coalition = useCoalition();
  const centred = align === 'center';

  return (
    <View style={[styles.wrap, centred && styles.centred]}>
      {coalition?.name && (
        <Text style={[styles.name, centred && styles.textCentred]} numberOfLines={1} accessibilityRole="header">
          {coalition.name}
        </Text>
      )}
      <View style={styles.row}>
        <AdminBadge />
        {coalition?.name && coalition.region && <Text style={styles.region}>{coalition.region}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1, alignItems: 'flex-start', gap: 5 },
  centred: { alignItems: 'center' },
  name: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, color: color.textPrimary },
  textCentred: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  region: { ...type.caption, color: color.textSecondary },
});

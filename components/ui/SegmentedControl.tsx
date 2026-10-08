import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, hit, radius, shadow } from '@/constants/design';

interface Option<T extends string> {
  id: T;
  label: string;
}

/** Two-to-three way switch. Each segment is a tab with accessibilityState.selected. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.seg, on && styles.segOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3, backgroundColor: color.surfaceMuted, borderRadius: radius.md },
  // 40 + 3px track padding on each side = 46pt touch area.
  seg: { flex: 1, minHeight: hit.min - 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  segOn: { backgroundColor: color.background, ...shadow.sm },
  text: { fontFamily: font.medium, fontSize: 14, color: color.textSecondary },
  textOn: { fontFamily: font.semibold, color: color.textPrimary },
});

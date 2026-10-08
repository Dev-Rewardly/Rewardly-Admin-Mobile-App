import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, radius, space, type } from '@/constants/design';

/** error: something failed (live region). info: a standing notice, e.g. held declarations. */
export function Banner({
  tone,
  message,
  style,
}: {
  tone: 'error' | 'info';
  message: string;
  style?: StyleProp<ViewStyle>;
}) {
  const error = tone === 'error';
  return (
    <View
      style={[styles.wrap, error ? styles.error : styles.info, style]}
      accessibilityLiveRegion={error ? 'polite' : 'none'}
      accessibilityRole={error ? 'alert' : 'text'}
    >
      <Ionicons
        name={error ? 'alert-circle-outline' : 'information-circle-outline'}
        size={error ? 18 : 16}
        color={error ? color.error : color.textSecondary}
        style={styles.icon}
      />
      <Text style={[styles.text, error ? styles.errorText : styles.infoText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.md },
  error: { backgroundColor: color.errorSurface, paddingVertical: space.md, paddingHorizontal: 14 },
  info: { backgroundColor: color.surface, paddingVertical: 10, paddingHorizontal: space.md, borderRadius: 10 },
  icon: { marginTop: 1 },
  text: { flex: 1 },
  errorText: { ...type.meta, color: color.errorText },
  infoText: { ...type.caption, color: color.textBody },
});

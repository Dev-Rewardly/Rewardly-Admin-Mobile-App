import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { color, radius, shadow, space, type } from '@/constants/design';

/** Brief confirmation after a decision. No undo: the review route has none. */
export function Toast({ message, onHide }: { message: string | null; onHide: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const id = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onHide());
    }, 2400);
    return () => clearTimeout(id);
  }, [message, onHide, opacity]);

  if (!message) return null;
  return (
    <Animated.View style={[styles.toast, { opacity }]} accessibilityLiveRegion="polite" accessibilityRole="alert" pointerEvents="none">
      <Ionicons name="checkmark" size={16} color={color.onToast} />
      <Text style={styles.text} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space.xl - 4,
    right: space.xl - 4,
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    borderRadius: 14,
    backgroundColor: color.toast,
    ...shadow.lg,
  },
  text: { ...type.label, color: color.onToast, flex: 1 },
});

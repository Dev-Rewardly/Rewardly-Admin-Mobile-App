import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, radius, space } from '@/constants/design';

/**
 * Modal sheet anchored to the bottom. Scrolls, and rides above the keyboard,
 * so a text field inside it can never be covered.
 */
export function BottomSheet({
  visible,
  onClose,
  accessibilityLabel,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.scrim}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Pressable
              style={styles.flex}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              importantForAccessibility="no"
            />
            <View
              style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) + space.md }]}
              accessibilityViewIsModal
              accessibilityLabel={accessibilityLabel}
            >
              <View style={styles.grabber} />
              {children}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, backgroundColor: color.scrim },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl - 4,
    paddingTop: 10,
    gap: space.lg,
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: color.borderStrong },
});

import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { color } from '@/constants/design';

// Approvals is the first tab with real data behind it; Members and Redeem
// arrive with their milestones.
//
// It is listed BEFORE dashboard deliberately: dashboard is still a placeholder
// showing no figures, and approvals is the reason an admin opens this app. The
// first tab is the one that opens.
export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: color.brand }}>
      <Tabs.Screen name="approvals" options={{ title: t('tabs.approvals') }} />
      <Tabs.Screen name="dashboard" options={{ title: t('tabs.dashboard') }} />
    </Tabs>
  );
}

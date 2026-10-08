import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { color } from '@/constants/design';
import { CoalitionProvider } from '@/context/CoalitionContext';

// Approvals is the first tab with real data behind it; Members and Redeem
// arrive with their milestones.
//
// It is listed BEFORE dashboard deliberately: dashboard is still a placeholder
// showing no figures, and approvals is the reason an admin opens this app. The
// first tab is the one that opens.
export default function TabsLayout() {
  const { t } = useTranslation();
  // The coalition is loaded here, once, so both tabs share one request.
  return (
    <CoalitionProvider>
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: color.brand }}>
        <Tabs.Screen
          name="approvals"
          options={{
            title: t('tabs.approvals'),
            tabBarIcon: tabIcon('checkmark-circle', 'checkmark-circle-outline'),
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t('tabs.dashboard'),
            tabBarIcon: tabIcon('grid', 'grid-outline'),
          }}
        />
      </Tabs>
    </CoalitionProvider>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Filled when selected, outlined when not, so the current tab reads without colour alone. */
function tabIcon(on: IconName, off: IconName) {
  return function TabIcon({ focused, color: tint, size }: { focused: boolean; color: string; size: number }) {
    return <Ionicons name={focused ? on : off} color={tint} size={size} />;
  };
}

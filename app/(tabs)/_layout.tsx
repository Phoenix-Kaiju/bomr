import { Tabs, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { INITIAL_TAB_ROUTE, TAB_ROUTE_ORDER, type TabRoute } from '@/constants/navigation';
import { getThemePalette } from '@/constants/theme';
import { useAppSettings } from '@/data/app-settings';

export default function TabLayout() {
  const { settings } = useAppSettings();
  const palette = getThemePalette(settings.themePreset);
  const tabAccent = palette.tint;
  const router = useRouter();
  const pathname = usePathname();
  const current = pathname.split('/').pop() ?? 'bom';
  const currentIndex = TAB_ROUTE_ORDER.indexOf(current as TabRoute);

  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(20)
    .activeOffsetX([-25, 25])
    .onEnd((event) => {
      if (currentIndex < 0) {
        return;
      }
      if (event.translationX <= -45) {
        const nextIndex = (currentIndex + 1) % TAB_ROUTE_ORDER.length;
        router.navigate(`/(tabs)/${TAB_ROUTE_ORDER[nextIndex]}` as never);
      } else if (event.translationX >= 45) {
        const prevIndex = (currentIndex - 1 + TAB_ROUTE_ORDER.length) % TAB_ROUTE_ORDER.length;
        router.navigate(`/(tabs)/${TAB_ROUTE_ORDER[prevIndex]}` as never);
      }
    });

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={{ flex: 1 }} collapsable={false}>
        <Tabs
          initialRouteName={INITIAL_TAB_ROUTE}
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: tabAccent,
          tabBarInactiveTintColor: palette.tabIconDefault,
          tabBarStyle: {
            backgroundColor: palette.background,
            borderTopColor: palette.border,
              borderTopWidth: 1,
              height: 82,
              paddingBottom: 18,
              paddingTop: 10,
            },
          }}>
          <Tabs.Screen
            name="bom"
            options={{
              title: 'BOM',
              tabBarIcon: ({ color }) => <IconSymbol size={26} name="cube.box.fill" color={color} />,
            }}
          />
          <Tabs.Screen
            name="build"
            options={{
              title: 'Build',
              tabBarIcon: ({ color }) => <IconSymbol size={26} name="target" color={color} />,
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              title: 'Calendar',
              tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar" color={color} />,
            }}
          />
          <Tabs.Screen
            name="progress"
            options={{
              title: 'Progress',
              tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.bar.fill" color={color} />,
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ color }) => <IconSymbol size={26} name="gearshape.fill" color={color} />,
            }}
          />
        </Tabs>
      </View>
    </GestureDetector>
  );
}

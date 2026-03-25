import { Tabs } from 'expo-router'
import { LayoutDashboard, Receipt, Lightbulb, MessageCircle, Settings } from 'lucide-react-native'
import { t } from '@spending-dashboard/shared'

const ICON_SIZE = 22

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1d27',
          borderTopColor: '#ffffff08',
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#00d4aa',
        tabBarInactiveTintColor: '#8b8fa3',
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('dashboard.title'),
          tabBarIcon: ({ color }) => <LayoutDashboard size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t('transactions.title'),
          tabBarIcon: ({ color }) => <Receipt size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t('insights.title'),
          tabBarIcon: ({ color }) => <Lightbulb size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('chat.title'),
          tabBarIcon: ({ color }) => <MessageCircle size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ color }) => <Settings size={ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  )
}

/**
 * GlucoPilot Mobile App — App.js (Expo entry point)
 *
 * Install Expo:
 *   npm install -g expo-cli
 *   npx create-expo-app glucopilot-mobile
 *   Copy this file and src/ into the project
 *
 * Dependencies to install:
 *   npx expo install @react-navigation/native @react-navigation/bottom-tabs
 *   npx expo install react-native-screens react-native-safe-area-context
 *   npx expo install @react-native-async-storage/async-storage
 *   npx expo install react-native-svg
 *   npx expo install expo-notifications expo-network
 *   npm install react-native-gifted-charts
 *
 * Run on your phone:
 *   npx expo start --tunnel
 *   Scan QR with Expo Go app (iOS/Android)
 *
 * Build APK for Android:
 *   npx expo run:android   (requires Android Studio)
 *   OR use EAS Build:
 *   npm install -g eas-cli && eas build -p android --profile preview
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Alert, StatusBar, AppState,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen     from './src/screens/HomeScreen';
import TrendsScreen   from './src/screens/TrendsScreen';
import ProfileScreen  from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { LoginScreen } from './src/screens/LoginScreen';

import { WS, TokenStore } from './src/services/api';
import { usePumpStore }    from './src/store/pumpStore';

const Tab = createBottomTabNavigator();

// Tab bar icon (simple text-based, replace with react-native-vector-icons)
function TabIcon({ name, focused }) {
  const icons = { Home: '⬤', Trends: '📈', Profile: '👤', Settings: '⚙️' };
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.4 }}>
      {icons[name] || '●'}
    </Text>
  );
}

export default function App() {
  const [authed,    setAuthed]    = useState(false);
  const [checking,  setChecking]  = useState(true);
  const appState    = useRef(AppState.currentState);
  const setPumpData = usePumpStore(s => s.setPumpData);
  const setGlucose  = usePumpStore(s => s.setGlucose);
  const setConnections = usePumpStore(s => s.setConnections);

  // ── Check saved token ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = await TokenStore.get();
      setAuthed(!!token);
      setChecking(false);
    })();
  }, []);

  // ── WebSocket setup ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed) return;

    WS.connectAll();

    const unsubs = [
      WS.on('backend:connected',    () => setConnections({ backend: true })),
      WS.on('backend:disconnected', () => setConnections({ backend: false })),
      WS.on('esp32:connected',      () => setConnections({ esp32: true })),
      WS.on('esp32:disconnected',   () => setConnections({ esp32: false })),

      WS.on('pump:status', (msg) => setPumpData(msg)),
      WS.on('esp32:status', (msg) => setPumpData(msg)),

      WS.on('pump:glucose', (msg) => setGlucose(msg)),

      WS.on('esp32:any', (msg) => {
        if (msg.alarmActive && msg.alarmMsg) {
          Alert.alert('⚠️ Pump Alert', msg.alarmMsg, [
            { text: 'Dismiss', onPress: () => WS.cancelAlarm() },
          ]);
        }
      }),
    ];

    // App state — reconnect when foregrounded
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        WS.connectAll();
      }
      appState.current = next;
    });

    return () => {
      unsubs.forEach(u => u());
      sub.remove();
      WS.disconnect();
    };
  }, [authed]);

  if (checking) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>GlucoPilot</Text>
        <Text style={styles.splashSub}>Loading…</Text>
      </View>
    );
  }

  if (!authed) {
    return (
      <SafeAreaProvider>
        <LoginScreen onAuth={() => setAuthed(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
      <NavigationContainer theme={{
        colors: {
          background: '#0a0e1a', card: '#111827', text: '#f0f4ff',
          border: 'rgba(255,255,255,0.07)', primary: '#00d4aa',
          notification: '#ff4757',
        },
        dark: true,
      }}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
            tabBarStyle: {
              backgroundColor: 'rgba(10,14,26,0.95)',
              borderTopColor: 'rgba(255,255,255,0.07)',
              borderTopWidth: 0.5,
              paddingBottom: 20,
              height: 70,
            },
            tabBarActiveTintColor: '#00d4aa',
            tabBarInactiveTintColor: '#546480',
            tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
            headerShown: false,
          })}
        >
          <Tab.Screen name="Home"     component={HomeScreen} />
          <Tab.Screen name="Trends"   component={TrendsScreen} />
          <Tab.Screen name="Profile"  component={ProfileScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: '#0a0e1a',
    alignItems: 'center', justifyContent: 'center',
  },
  splashTitle: {
    fontSize: 32, fontWeight: '700', color: '#00d4aa', letterSpacing: -1,
  },
  splashSub: { fontSize: 14, color: '#546480', marginTop: 8 },
});

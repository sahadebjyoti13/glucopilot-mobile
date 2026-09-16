/**
 * GlucoPilot App.js — with proper auth flow and mandatory fingerprint on every open
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Alert, StatusBar, AppState,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';

import HomeScreen     from './src/screens/HomeScreen';
import TrendsScreen   from './src/screens/TrendsScreen';
import ProfileScreen  from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { LoginScreen } from './src/screens/LoginScreen';

import { WS, TokenStore } from './src/services/api';
import { usePumpStore }    from './src/store/pumpStore';

const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }) {
  const icons = { Home: '⬤', Trends: '📈', Profile: '👤', Settings: '⚙️' };
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.4 }}>
      {icons[name] || '●'}
    </Text>
  );
}

// Auth states: 'checking' | 'logged_out' | 'needs_biometric' | 'authenticated'
export default function App() {
  const [authState,  setAuthState]  = useState('checking');
  const appState     = useRef(AppState.currentState);
  const setPumpData  = usePumpStore(s => s.setPumpData);
  const setGlucose   = usePumpStore(s => s.setGlucose);
  const setConns     = usePumpStore(s => s.setConnections);

  // ── On mount: check if logged in ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = await TokenStore.get();
      if (!token) {
        setAuthState('logged_out');
      } else {
        // Has token — require biometric/fingerprint before showing app
        await requireBiometric();
      }
    })();
  }, []);

  // ── Require biometric every time app comes to foreground ──────────────────
  const requireBiometric = async () => {
    const hasHW    = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHW || !enrolled) {
      // No biometric hardware — skip straight to app
      setAuthState('authenticated');
      return;
    }

    setAuthState('needs_biometric');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage:         'Unlock GlucoPilot',
      subtitle:              'Verify your identity to continue',
      cancelLabel:           'Sign out instead',
      disableDeviceFallback: false,
    });

    if (result.success) {
      setAuthState('authenticated');
    } else if (result.error === 'user_cancel') {
      // User tapped "Sign out instead"
      await TokenStore.clear();
      setAuthState('logged_out');
    } else {
      // Failed — try again
      Alert.alert(
        'Authentication Required',
        'Fingerprint not recognised. Try again.',
        [{ text: 'Retry', onPress: requireBiometric }]
      );
    }
  };

  // ── App state — lock on background ────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async next => {
      const wasBackground = appState.current.match(/inactive|background/);
      const nowActive     = next === 'active';

      if (wasBackground && nowActive && authState === 'authenticated') {
        // App came back to foreground — require biometric again
        const token = await TokenStore.get();
        if (token) await requireBiometric();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [authState]);

  // ── WebSocket setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (authState !== 'authenticated') return;

    WS.connectAll();

    const unsubs = [
      WS.on('backend:connected',    () => setConns({ backend: true })),
      WS.on('backend:disconnected', () => setConns({ backend: false })),
      WS.on('esp32:connected',      () => setConns({ esp32: true })),
      WS.on('esp32:disconnected',   () => setConns({ esp32: false })),
      WS.on('pump:status',  msg => setPumpData(msg)),
      WS.on('esp32:status', msg => setPumpData(msg)),
      WS.on('pump:glucose', msg => {
  setGlucose({ value: msg.value, trend: msg.trend });
  setPumpData({ iob: msg.iob, basalRate: msg.basalRate });
}),
      WS.on('esp32:any', msg => {
        if (msg.alarmActive && msg.alarmMsg) {
          Alert.alert('⚠️ Pump Alert', msg.alarmMsg, [
            { text: 'Dismiss', onPress: () => WS.cancelAlarm() },
          ]);
        }
      }),
    ];

    return () => {
      unsubs.forEach(u => u());
      WS.disconnect();
    };
  }, [authState]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authState === 'checking') {
    return (
      <View style={s.splash}>
        <Text style={s.splashTitle}>GlucoPilot</Text>
        <Text style={s.splashSub}>Loading…</Text>
      </View>
    );
  }

  if (authState === 'logged_out') {
    return (
      <SafeAreaProvider>
        <LoginScreen onAuth={async () => {
          // After login, immediately require biometric
          await requireBiometric();
        }} />
      </SafeAreaProvider>
    );
  }

  if (authState === 'needs_biometric') {
    return (
      <View style={s.splash}>
        <Text style={{ fontSize: 60, marginBottom: 16 }}>👆</Text>
        <Text style={s.splashTitle}>GlucoPilot</Text>
        <Text style={s.splashSub}>Verifying identity…</Text>
      </View>
    );
  }

  // authenticated
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

const s = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: '#0a0e1a',
    alignItems: 'center', justifyContent: 'center',
  },
  splashTitle: { fontSize: 32, fontWeight: '700', color: '#00d4aa', letterSpacing: -1 },
  splashSub:   { fontSize: 14, color: '#546480', marginTop: 8 },
});

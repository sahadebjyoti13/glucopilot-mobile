import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Config, WS, TokenStore, API } from '../services/api';
import { usePumpStore } from '../store/pumpStore';

const colors = {
  bg: '#0a0e1a', card: '#151d2e', card2: '#1a2235',
  accent: '#00d4aa', danger: '#ff4757', text: '#f0f4ff',
  text2: '#8a9bb5', text3: '#546480', border: 'rgba(255,255,255,0.07)',
};

export default function SettingsScreen() {
  const [backendIP,  setBackendIP]  = useState('');
  const [esp32IP,    setEsp32IP]    = useState('');
  const [testing,    setTesting]    = useState(false);
  const [highAlert,  setHighAlert]  = useState(true);
  const [lowAlert,   setLowAlert]   = useState(true);
  const [suspendLow, setSuspendLow] = useState(true);
  const [nightMode,  setNightMode]  = useState(true);

  const { backendConnected, esp32Connected } = usePumpStore();

  useEffect(() => {
    Config.getBackendIP().then(setBackendIP);
    Config.getESP32IP().then(setEsp32IP);
  }, []);

  const saveIPs = async () => {
    await Config.setBackendIP(backendIP);
    await Config.setESP32IP(esp32IP);
    WS.reconnectAll();
    Alert.alert('✅ Saved', 'Reconnecting to new addresses…');
  };

  const testConnection = async () => {
    setTesting(true);
    await Config.setBackendIP(backendIP);
    try {
      await API.ping();
      Alert.alert('✅ Backend reachable!', `Connected to ${backendIP}:3000`);
    } catch {
      Alert.alert('❌ Cannot reach backend', `Make sure:\n• Backend is running\n• IP is ${backendIP}\n• Both devices on same WiFi`);
    } finally {
      setTesting(false);
    }
  };

  const logout = async () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await TokenStore.clear();
        usePumpStore.getState().reset();
        WS.disconnect();
      }},
    ]);
  };

  const toggle = (label, desc, val, setVal) => (
    <View style={s.toggleRow} key={label}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleName}>{label}</Text>
        <Text style={s.toggleDesc}>{desc}</Text>
      </View>
      <Switch value={val} onValueChange={setVal}
        trackColor={{ true: colors.accent, false: colors.card2 }} thumbColor="#fff" />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={s.pageTitle}>Settings</Text>

        {/* CONNECTION — editable IPs */}
        <Text style={s.sectionLabel}>Connection</Text>
        <View style={s.section}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLbl}>Backend IP</Text>
              <Text style={s.rowHint}>Your laptop's IP address</Text>
            </View>
            <TextInput
              style={s.ipInput}
              value={backendIP}
              onChangeText={setBackendIP}
              keyboardType="decimal-pad"
              placeholder="e.g. 10.11.5.101"
              placeholderTextColor={colors.text3}
            />
          </View>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLbl}>ESP32 IP</Text>
              <Text style={s.rowHint}>Pump WiFi address</Text>
            </View>
            <TextInput
              style={s.ipInput}
              value={esp32IP}
              onChangeText={setEsp32IP}
              keyboardType="decimal-pad"
              placeholder="192.168.4.1"
              placeholderTextColor={colors.text3}
            />
          </View>

          {/* Status indicators */}
          <View style={s.statusRow}>
            <View style={[s.statusPill, backendConnected && s.statusPillOn]}>
              <View style={[s.statusDot, { backgroundColor: backendConnected ? colors.accent : colors.danger }]} />
              <Text style={s.statusText}>{backendConnected ? 'Backend online' : 'Backend offline'}</Text>
            </View>
            <View style={[s.statusPill, esp32Connected && s.statusPillOn]}>
              <View style={[s.statusDot, { backgroundColor: esp32Connected ? colors.accent : colors.danger }]} />
              <Text style={s.statusText}>{esp32Connected ? 'ESP32 online' : 'ESP32 offline'}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, margin: 12 }}>
            <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={testConnection} disabled={testing}>
              <Text style={s.btnText}>{testing ? 'Testing…' : '🔍 Test'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnSave, { flex: 1 }]} onPress={saveIPs}>
              <Text style={[s.btnText, { color: '#000' }]}>💾 Save & Connect</Text>
            </TouchableOpacity>
          </View>

          {/* Quick tip */}
          <View style={s.tipBox}>
            <Text style={s.tipText}>💡 IP changed? Run <Text style={{ color: colors.accent }}>ipconfig</Text> on your laptop, update above, tap Save & Connect.</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>Glucose Alerts</Text>
        <View style={s.section}>
          {toggle('High glucose alert', 'Alert when above 180 mg/dL', highAlert, setHighAlert)}
          {toggle('Low glucose alert',  'Alert when below 70 mg/dL',  lowAlert,  setLowAlert)}
        </View>

        <Text style={s.sectionLabel}>Pump Safety</Text>
        <View style={s.section}>
          {toggle('Suspend on low',      'Stop insulin below 70 mg/dL', suspendLow, setSuspendLow)}
          {toggle('Nighttime safe mode', 'Conservative 10pm–6am',       nightMode,  setNightMode)}
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={s.version}>GlucoPilot v1.0.0 — For medical use under physician supervision</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pageTitle:    { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 16, letterSpacing: -0.5 },
  sectionLabel: { fontSize: 11, color: colors.text3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  section:      { backgroundColor: colors.card, borderRadius: 16, borderWidth: 0.5, borderColor: colors.border, overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowLbl:       { fontSize: 14, color: colors.text, fontWeight: '500' },
  rowHint:      { fontSize: 11, color: colors.text3, marginTop: 1 },
  ipInput:      { fontSize: 14, fontWeight: '700', color: colors.accent, textAlign: 'right', minWidth: 130, borderBottomWidth: 1, borderBottomColor: colors.accent, paddingBottom: 2 },
  statusRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  statusPill:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.card2, borderRadius: 10, padding: 8, borderWidth: 0.5, borderColor: colors.border },
  statusPillOn: { borderColor: 'rgba(0,212,170,0.4)' },
  statusDot:    { width: 7, height: 7, borderRadius: 4 },
  statusText:   { fontSize: 11, color: colors.text2, fontWeight: '600' },
  btn:          { backgroundColor: colors.card2, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: colors.accent },
  btnSave:      { backgroundColor: colors.accent },
  btnText:      { color: colors.accent, fontWeight: '700', fontSize: 13 },
  tipBox:       { margin: 12, backgroundColor: 'rgba(0,212,170,0.06)', borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: 'rgba(0,212,170,0.2)' },
  tipText:      { fontSize: 12, color: colors.text3, lineHeight: 18 },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  toggleName:   { fontSize: 14, color: colors.text, marginBottom: 2 },
  toggleDesc:   { fontSize: 11, color: colors.text3 },
  logoutBtn:    { marginTop: 24, backgroundColor: 'rgba(255,71,87,0.12)', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: colors.danger },
  logoutText:   { color: colors.danger, fontWeight: '700', fontSize: 15 },
  version:      { fontSize: 11, color: colors.text3, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});

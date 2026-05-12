/**
 * GlucoPilot — Remaining Screens
 * LoginScreen, ProfileScreen, SettingsScreen, TrendsScreen
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Switch, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API, WS, TokenStore } from '../services/api';
import { usePumpStore } from '../store/pumpStore';

const colors = {
  bg: '#0a0e1a', bg2: '#111827', card: '#151d2e', card2: '#1a2235',
  accent: '#00d4aa', accent2: '#0099ff', warn: '#ffa502', danger: '#ff4757',
  purple: '#a855f7', text: '#f0f4ff', text2: '#8a9bb5', text3: '#546480',
  border: 'rgba(255,255,255,0.07)',
};

// ══════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ══════════════════════════════════════════════════════════════
export function LoginScreen({ onAuth }) {
  const [mode,     setMode]     = useState('login');  // 'login' | 'register'
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try {
      if (mode === 'login') {
        await API.login(email.trim(), password);
      } else {
        if (!name) return Alert.alert('Error', 'Name required');
        await API.register(name.trim(), email.trim(), password);
      }
      onAuth();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={ls.logo}>Gluco<Text style={{ color: colors.accent }}>Pilot</Text></Text>
        <Text style={ls.sub}>Insulin Pump Management</Text>

        <View style={ls.card}>
          <View style={ls.tabs}>
            {['login', 'register'].map(m => (
              <TouchableOpacity key={m} style={[ls.tab, mode === m && ls.tabActive]} onPress={() => setMode(m)}>
                <Text style={[ls.tabText, mode === m && ls.tabTextActive]}>{m === 'login' ? 'Sign In' : 'Register'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'register' && (
            <TextInput style={ls.input} placeholder="Full Name" placeholderTextColor={colors.text3}
              value={name} onChangeText={setName} autoCapitalize="words" />
          )}
          <TextInput style={ls.input} placeholder="Email" placeholderTextColor={colors.text3}
            value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={ls.input} placeholder="Password" placeholderTextColor={colors.text3}
            value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={ls.btn} onPress={submit} disabled={loading}>
            <Text style={ls.btnText}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={ls.disclaimer}>For medical use only. Consult your endocrinologist before adjusting settings.</Text>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const ls = StyleSheet.create({
  logo:  { fontSize: 36, fontWeight: '800', color: colors.text, textAlign: 'center', letterSpacing: -1 },
  sub:   { fontSize: 14, color: colors.text3, textAlign: 'center', marginBottom: 32 },
  card:  { backgroundColor: colors.card, borderRadius: 24, padding: 20, borderWidth: 0.5, borderColor: colors.border },
  tabs:  { flexDirection: 'row', backgroundColor: colors.card2, borderRadius: 12, padding: 3, marginBottom: 20 },
  tab:   { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.text3, fontWeight: '600' },
  tabTextActive: { color: '#000' },
  input: { backgroundColor: colors.card2, borderRadius: 14, padding: 14, color: colors.text, fontSize: 15, marginBottom: 10, borderWidth: 0.5, borderColor: colors.border },
  btn:   { backgroundColor: colors.accent, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  disclaimer: { fontSize: 11, color: colors.text3, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});

// ══════════════════════════════════════════════════════════════
// PROFILE SCREEN
// ══════════════════════════════════════════════════════════════
export function ProfileScreen() {
  const { profile, setProfile } = usePumpStore();
  const [form,    setForm]    = useState({});
  const [saving,  setSaving]  = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    API.getProfile().then(p => {
      setProfile(p);
      setForm(p);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await API.updateProfile(form);
      setProfile(form);
      Alert.alert('✅ Saved', 'Profile updated successfully');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, opts = {}) => (
    <View style={ps.row}>
      <Text style={ps.rowLabel}>{label}</Text>
      <TextInput
        style={ps.rowInput}
        value={String(form[key] ?? '')}
        onChangeText={v => setForm(f => ({ ...f, [key]: opts.numeric ? parseFloat(v) || 0 : v }))}
        keyboardType={opts.numeric ? 'decimal-pad' : 'default'}
        placeholderTextColor={colors.text3}
        {...opts}
      />
    </View>
  );

  const initials = (form.name || 'Patient').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text2 }}>Loading…</Text></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={ps.pageTitle}>Profile</Text>
        <View style={ps.avatar}><Text style={ps.avatarText}>{initials}</Text></View>

        <Text style={ps.sectionLabel}>Personal</Text>
        <View style={ps.section}>
          {field('Full Name',      'name')}
          {field('Date of Birth',  'dob')}
          {field('Biological Sex', 'sex')}
        </View>

        <Text style={ps.sectionLabel}>Clinical Metrics</Text>
        <View style={ps.section}>
          {field('Weight (kg)',    'weight_kg',    { numeric: true })}
          {field('Height (cm)',    'height_cm',    { numeric: true })}
          {field('Total Daily Dose (U)', 'tdd',   { numeric: true })}
          {field('Insulin:Carb Ratio (g/U)', 'icr', { numeric: true })}
          {field('Insulin Sensitivity (mg/dL/U)', 'isf', { numeric: true })}
          {field('Target BG (mg/dL)', 'target_bg', { numeric: true })}
          {field('Low Alert (mg/dL)', 'target_low', { numeric: true })}
          {field('High Alert (mg/dL)', 'target_high', { numeric: true })}
          {field('Duration of Action (hr)', 'dia_hr', { numeric: true })}
        </View>

        <Text style={ps.sectionLabel}>Devices & Algorithm</Text>
        <View style={ps.section}>
          {field('CGM Type',         'cgm_type')}
          {field('Insulin Type',     'insulin_type')}
          {field('Control Algorithm', 'algo')}
        </View>

        <TouchableOpacity style={ps.saveBtn} onPress={save} disabled={saving}>
          <Text style={ps.saveBtnText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const ps = StyleSheet.create({
  pageTitle: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 16, letterSpacing: -0.5 },
  avatar:    { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#000' },
  sectionLabel: { fontSize: 11, color: colors.text3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  section: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 0.5, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowLabel: { flex: 1, fontSize: 14, color: colors.text2 },
  rowInput: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'right', minWidth: 100 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});

// ══════════════════════════════════════════════════════════════
// TRENDS SCREEN
// ══════════════════════════════════════════════════════════════
export function TrendsScreen() {
  const { glucoseHistory, profile } = usePumpStore();
  const [range,    setRange]    = useState('24h');
  const [stats,    setStats]    = useState(null);
  const [bolusLog, setBolusLog] = useState([]);

  useEffect(() => {
    API.getDailyStats().then(setStats).catch(() => {});
    API.getBolusHistory().then(setBolusLog).catch(() => {});
  }, []);

  const tir      = stats?.tir ?? '--';
  const avg      = stats?.avg ?? '--';
  const readings = glucoseHistory.slice(-50);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={ts.pageTitle}>Trends</Text>

        {/* Time selector */}
        <View style={ts.timeRow}>
          {['3H','6H','24H','7D','30D'].map(r => (
            <TouchableOpacity key={r} style={[ts.timeBtn, range === r && ts.timeBtnActive]} onPress={() => setRange(r)}>
              <Text style={[ts.timeBtnText, range === r && ts.timeBtnTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sparkline chart */}
        <View style={ts.chartCard}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 1 }}>
            {readings.map((r, i) => {
              const v = r.value || r;
              const h = Math.max(4, ((v - 40) / (260 - 40)) * 120);
              const c = v < 70 ? colors.danger : v > 180 ? colors.warn : colors.accent;
              return <View key={i} style={{ flex: 1, height: h, backgroundColor: c, borderRadius: 2, opacity: 0.85 }} />;
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={ts.chartAxisLabel}>Low: {profile?.target_low || 70}</Text>
            <Text style={ts.chartAxisLabel}>Target: {profile?.target_bg || 100}</Text>
            <Text style={ts.chartAxisLabel}>High: {profile?.target_high || 180}</Text>
          </View>
        </View>

        {/* Summary stats */}
        <View style={ts.statsRow}>
          {[
            { label: 'Time in Range', val: tir + '%', c: colors.accent },
            { label: 'Average BG',    val: avg + ' mg/dL', c: colors.text },
            { label: 'SD',            val: '±' + (stats?.sd ?? '--'), c: colors.text2 },
          ].map(s => (
            <View key={s.label} style={ts.statCard}>
              <Text style={[ts.statVal, { color: s.c }]}>{s.val}</Text>
              <Text style={ts.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Bolus log */}
        <Text style={ts.sectionTitle}>Bolus History</Text>
        {bolusLog.length === 0 && <Text style={{ color: colors.text3, padding: 16 }}>No boluses recorded yet.</Text>}
        {bolusLog.map(b => (
          <View key={b.id} style={ts.logRow}>
            <View style={ts.logIcon}><Text>💉</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={ts.logTitle}>{b.type === 'manual' ? 'Manual Bolus' : 'Auto Bolus'}</Text>
              <Text style={ts.logSub}>BG: {b.bg_at_time ? Math.round(b.bg_at_time) : '--'} mg/dL · IOB: {b.iob_at_time?.toFixed(1) ?? '--'} U</Text>
              <Text style={ts.logSub}>{new Date(b.ts * 1000).toLocaleString()}</Text>
            </View>
            <Text style={[ts.logVal, { color: colors.accent2 }]}>{b.units.toFixed(1)} U</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const ts = StyleSheet.create({
  pageTitle: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 16, letterSpacing: -0.5 },
  timeRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  timeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  timeBtnActive: { backgroundColor: colors.accent },
  timeBtnText: { fontSize: 12, fontWeight: '600', color: colors.text3 },
  timeBtnTextActive: { color: '#000' },
  chartCard: { backgroundColor: colors.card, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 0.5, borderColor: colors.border },
  chartAxisLabel: { fontSize: 10, color: colors.text3 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  statVal: { fontSize: 18, fontWeight: '700' },
  statLbl: { fontSize: 10, color: colors.text3, marginTop: 3, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 10 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 13, marginBottom: 6, borderWidth: 0.5, borderColor: colors.border },
  logIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,153,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  logTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  logSub: { fontSize: 11, color: colors.text3, marginTop: 1 },
  logVal: { fontSize: 15, fontWeight: '700' },
});

// ══════════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ══════════════════════════════════════════════════════════════
export function SettingsScreen() {
  const [esp32IP,    setEsp32IP]   = useState('192.168.4.1');
  const [backendURL, setBackendURL]= useState('192.168.1.100:3000');
  const [highAlert,  setHighAlert] = useState(true);
  const [lowAlert,   setLowAlert]  = useState(true);
  const [suspendLow, setSuspendLow]= useState(true);
  const [maxBolus,   setMaxBolus]  = useState(true);
  const [nightMode,  setNightMode] = useState(true);
  const [cloudSync,  setCloudSync] = useState(true);

  const { backendConnected, esp32Connected } = usePumpStore();

  const testConnection = () => {
    WS.connectAll();
    setTimeout(() => {
      Alert.alert('Connection Test', `Backend: ${usePumpStore.getState().backendConnected ? '✅' : '❌'}\nESP32: ${usePumpStore.getState().esp32Connected ? '✅' : '❌'}`);
    }, 2000);
  };

  const logout = async () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await TokenStore.clear();
        await TokenStore.setPatientId('');
        usePumpStore.getState().reset();
        WS.disconnect();
      }},
    ]);
  };

  const toggle = (label, desc, val, setVal) => (
    <View style={ss.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={ss.toggleName}>{label}</Text>
        <Text style={ss.toggleDesc}>{desc}</Text>
      </View>
      <Switch value={val} onValueChange={setVal} trackColor={{ true: colors.accent, false: colors.card2 }} thumbColor="#fff" />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={ss.pageTitle}>Settings</Text>

        <Text style={ss.sectionLabel}>Connection</Text>
        <View style={ss.section}>
          <View style={ss.row}><Text style={ss.rowLbl}>ESP32 IP</Text><TextInput style={ss.rowInput} value={esp32IP} onChangeText={setEsp32IP} keyboardType="decimal-pad" /></View>
          <View style={ss.row}><Text style={ss.rowLbl}>Backend URL</Text><TextInput style={ss.rowInput} value={backendURL} onChangeText={setBackendURL} autoCapitalize="none" /></View>
          <View style={ss.row}>
            <Text style={ss.rowLbl}>Status</Text>
            <Text style={ss.rowLbl}>
              <Text style={{ color: esp32Connected ? colors.accent : colors.danger }}>ESP32 </Text>
              <Text style={{ color: backendConnected ? colors.accent : colors.danger }}>· Cloud</Text>
            </Text>
          </View>
          <TouchableOpacity style={ss.testBtn} onPress={testConnection}>
            <Text style={ss.testBtnText}>Test Connection</Text>
          </TouchableOpacity>
        </View>

        <Text style={ss.sectionLabel}>Glucose Alerts</Text>
        <View style={ss.section}>
          {toggle('High glucose alert', 'Alert when above 180 mg/dL', highAlert, setHighAlert)}
          {toggle('Low glucose alert', 'Alert when below 70 mg/dL', lowAlert, setLowAlert)}
        </View>

        <Text style={ss.sectionLabel}>Pump Safety</Text>
        <View style={ss.section}>
          {toggle('Suspend on low', 'Stop insulin below 70 mg/dL', suspendLow, setSuspendLow)}
          {toggle('Max bolus guard', 'Block bolus above 15 U', maxBolus, setMaxBolus)}
          {toggle('Nighttime safe mode', 'Conservative 10pm–6am', nightMode, setNightMode)}
        </View>

        <Text style={ss.sectionLabel}>Data</Text>
        <View style={ss.section}>
          {toggle('Cloud backup', 'Auto-sync readings', cloudSync, setCloudSync)}
        </View>

        <TouchableOpacity style={ss.logoutBtn} onPress={logout}>
          <Text style={ss.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={ss.version}>GlucoPilot v1.0.0 — For medical use under physician supervision</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  pageTitle: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 16, letterSpacing: -0.5 },
  sectionLabel: { fontSize: 11, color: colors.text3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  section: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 0.5, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowLbl: { fontSize: 14, color: colors.text2 },
  rowInput: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'right', minWidth: 140 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  toggleName: { fontSize: 14, color: colors.text, marginBottom: 2 },
  toggleDesc: { fontSize: 11, color: colors.text3 },
  testBtn: { margin: 12, backgroundColor: colors.card2, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: colors.accent },
  testBtnText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  logoutBtn: { marginTop: 24, backgroundColor: 'rgba(255,71,87,0.12)', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: colors.danger },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  version: { fontSize: 11, color: colors.text3, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});

export default LoginScreen;

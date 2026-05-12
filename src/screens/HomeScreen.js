/**
 * GlucoPilot — Home Screen
 * Real-time glucose, pump status, bolus delivery
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, Pressable, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePumpStore }  from '../store/pumpStore';
import { API, WS, calculateBolus } from '../services/api';

const { width } = Dimensions.get('window');

// ─── Tiny sparkline (pure RN, no dependency) ──────────────────────────────────
function MiniSparkline({ data, color = '#00d4aa', width: W = 320, height: H = 60 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.value || d);
  const min  = Math.min(...vals) - 10;
  const max  = Math.max(...vals) + 10;
  const range = max - min || 1;
  const pts  = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * W,
    y: H - ((v - min) / range) * H,
  }));
  // Build SVG path
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // Simple inline SVG via dangerouslySetInnerHTML not available in RN
  // Use react-native-svg in production; here we render rect bars as a fallback
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: 1 }}>
      {vals.slice(-20).map((v, i) => {
        const h = Math.max(2, ((v - min) / range) * H);
        const c = v < 70 ? '#ff4757' : v > 180 ? '#ffa502' : color;
        return <View key={i} style={{ width: (W / 20) - 2, height: h, backgroundColor: c, borderRadius: 1, opacity: 0.8 }} />;
      })}
    </View>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const {
    glucose, glucoseTrend, glucoseHistory,
    basalRate, iob, reservoir, totalToday, lastBolus,
    batteryPct, suspended, alarmActive, alarmMsg,
    backendConnected, esp32Connected,
    profile, setPumpData, setGlucose, glucoseStatus, trendArrow,
  } = usePumpStore();

  const [refreshing,   setRefreshing]   = useState(false);
  const [bolusModal,   setBolusModal]   = useState(false);
  const [bolusUnits,   setBolusUnits]   = useState(3.0);
  const [dailyStats,   setDailyStats]   = useState(null);
  const [lastUpdated,  setLastUpdated]  = useState(null);

  const status   = glucoseStatus();
  const arrow    = trendArrow();
  const bgColor  = status === 'low' ? '#ff4757' : status === 'high' ? '#ffa502' : '#00d4aa';

  const loadData = useCallback(async () => {
    try {
      const [stats, history] = await Promise.all([
        API.getDailyStats(),
        API.getGlucoseHistory(48),
      ]);
      setDailyStats(stats);
      if (history.length) {
        const latest = history[0];
        usePumpStore.getState().setGlucose({ value: latest.value, trend: latest.trend });
        usePumpStore.getState().addGlucoseHistory(history.reverse());
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.warn('loadData error', e);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000); // every 5min
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    WS.getStatus();
    setRefreshing(false);
  };

  const deliverBolus = () => {
    Alert.alert(
      'Confirm Bolus',
      `Deliver ${bolusUnits.toFixed(1)} U to pump?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deliver',
          style: 'destructive',
          onPress: async () => {
            try {
              WS.deliverBolus(bolusUnits);
              await API.postBolus(bolusUnits);
              setBolusModal(false);
              Alert.alert('✅ Bolus Sent', `${bolusUnits.toFixed(1)} U delivered`);
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const suggestedBolus = profile && glucose
    ? calculateBolus({ currentBG: glucose, targetBG: profile.target_bg, carbsG: 0, icr: profile.icr, isf: profile.isf, iob })
    : 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00d4aa" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Good morning</Text>
            <Text style={s.name}>{profile?.name?.split(' ')[0] || 'Patient'} 👋</Text>
          </View>
          <TouchableOpacity style={s.bolusQuickBtn} onPress={() => setBolusModal(true)}>
            <Text style={s.bolusQuickText}>+ Bolus</Text>
          </TouchableOpacity>
        </View>

        {/* Connection badges */}
        <View style={s.connRow}>
          <View style={[s.connPill, esp32Connected && s.connPillActive]}>
            <View style={[s.connDot, esp32Connected ? s.connDotActive : s.connDotOff]} />
            <Text style={s.connText}>{esp32Connected ? 'Pump Online' : 'Pump Offline'}</Text>
          </View>
          <View style={[s.connPill, backendConnected && s.connPillActive]}>
            <View style={[s.connDot, backendConnected ? s.connDotActive : s.connDotOff]} />
            <Text style={s.connText}>{backendConnected ? 'Cloud Active' : 'Cloud Offline'}</Text>
          </View>
        </View>

        {/* Glucose Hero */}
        <View style={[s.heroCard, { borderColor: bgColor + '50' }]}>
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>BLOOD GLUCOSE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={[s.heroValue, { color: bgColor }]}>
                  {glucose ? Math.round(glucose) : '--'}
                </Text>
                <Text style={s.heroUnit}>mg/dL  {arrow}</Text>
              </View>
              <Text style={s.heroSub}>{status === 'normal' ? 'In range' : status === 'low' ? '⚠ Low' : '⚠ High'} · {lastUpdated ? `${Math.round((Date.now() - lastUpdated) / 60000)}m ago` : 'Syncing…'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.heroLabel}>TIR TODAY</Text>
              <Text style={[s.heroTIR, { color: bgColor }]}>{dailyStats?.tir ?? '--'}%</Text>
              <Text style={s.heroLabel}>TARGET</Text>
              <Text style={[s.heroRange]}>70–180</Text>
            </View>
          </View>
          <MiniSparkline data={glucoseHistory.slice(-20)} color={bgColor} width={width - 64} />
        </View>

        {/* Alarm banner */}
        {alarmActive && (
          <TouchableOpacity style={s.alarmBanner} onPress={() => WS.cancelAlarm()}>
            <Text style={s.alarmText}>⚠️ {alarmMsg}</Text>
            <Text style={s.alarmDismiss}>Dismiss</Text>
          </TouchableOpacity>
        )}

        {/* Suspend banner */}
        {suspended && (
          <TouchableOpacity style={s.suspendBanner} onPress={() => { WS.resumePump(); Alert.alert('Pump Resumed'); }}>
            <Text style={s.suspendText}>🛑 Pump Suspended — Tap to Resume</Text>
          </TouchableOpacity>
        )}

        {/* Stats row */}
        <View style={s.statsRow}>
          {[
            { label: 'IOB', value: iob.toFixed(1) + ' U', color: '#0099ff' },
            { label: 'Basal', value: basalRate.toFixed(2) + ' U/h', color: '#00d4aa' },
            { label: 'Avg BG', value: (dailyStats?.avg ?? '--') + '', color: '#a855f7' },
          ].map(item => (
            <View key={item.label} style={s.statCard}>
              <Text style={s.statLabel}>{item.label}</Text>
              <Text style={[s.statValue, { color: item.color }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Delivery card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Insulin Delivery</Text>
            <Text style={s.cardBadge}>{suspended ? '⏸ PAUSED' : 'AUTO'}</Text>
          </View>
          <View style={s.deliveryGrid}>
            {[
              { label: 'Reservoir', value: reservoir.toFixed(0) + ' U', pct: reservoir / 300, color: '#ffa502' },
              { label: 'Today Total', value: totalToday.toFixed(1) + ' U', pct: totalToday / 60, color: '#00d4aa' },
              { label: 'Last Bolus', value: lastBolus.toFixed(1) + ' U', pct: lastBolus / 10, color: '#a855f7' },
              { label: 'Battery', value: batteryPct + '%', pct: batteryPct / 100, color: '#0099ff' },
            ].map(item => (
              <View key={item.label} style={s.deliveryItem}>
                <Text style={s.deliveryLabel}>{item.label}</Text>
                <Text style={[s.deliveryValue, { color: item.color }]}>{item.value}</Text>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${Math.min(100, item.pct * 100).toFixed(0)}%`, backgroundColor: item.color }]} />
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.bolusBtn} onPress={() => setBolusModal(true)}>
            <Text style={s.bolusBtnText}>+ Deliver Bolus</Text>
          </TouchableOpacity>
        </View>

        {/* Quick stats */}
        {dailyStats && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Today's Summary</Text>
            <View style={s.summaryGrid}>
              <View style={s.summaryItem}><Text style={s.summaryVal}>{dailyStats.tir}%</Text><Text style={s.summaryLbl}>Time in Range</Text></View>
              <View style={s.summaryItem}><Text style={[s.summaryVal, { color: '#ffa502' }]}>{dailyStats.high_pct}%</Text><Text style={s.summaryLbl}>High</Text></View>
              <View style={s.summaryItem}><Text style={[s.summaryVal, { color: '#ff4757' }]}>{dailyStats.low_pct}%</Text><Text style={s.summaryLbl}>Low</Text></View>
              <View style={s.summaryItem}><Text style={s.summaryVal}>±{dailyStats.sd}</Text><Text style={s.summaryLbl}>Std Dev</Text></View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bolus Modal */}
      <Modal visible={bolusModal} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setBolusModal(false)}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Deliver Bolus</Text>

            <View style={s.bolusInfo}>
              <View style={s.bolusInfoRow}><Text style={s.bolusInfoLbl}>Current BG</Text><Text style={[s.bolusInfoVal, { color: bgColor }]}>{glucose ? Math.round(glucose) : '--'} mg/dL</Text></View>
              <View style={s.bolusInfoRow}><Text style={s.bolusInfoLbl}>Suggested</Text><Text style={[s.bolusInfoVal, { color: '#0099ff' }]}>{suggestedBolus.toFixed(1)} U</Text></View>
              <View style={s.bolusInfoRow}><Text style={s.bolusInfoLbl}>Active IOB</Text><Text style={[s.bolusInfoVal, { color: '#a855f7' }]}>{iob.toFixed(1)} U</Text></View>
            </View>

            <Text style={s.doseDisplay}>{bolusUnits.toFixed(1)} <Text style={s.doseUnit}>U</Text></Text>

            {/* Simple +/- since no slider in this context */}
            <View style={s.stepRow}>
              {[0.5, 0.1].map(step => (
                <React.Fragment key={step}>
                  <TouchableOpacity style={s.stepBtn} onPress={() => setBolusUnits(u => Math.max(0.1, parseFloat((u - step).toFixed(1))))}>
                    <Text style={s.stepBtnText}>−{step}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.stepBtn} onPress={() => setBolusUnits(u => Math.min(15, parseFloat((u + step).toFixed(1))))}>
                    <Text style={s.stepBtnText}>+{step}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>

            <TouchableOpacity style={s.confirmBtn} onPress={deliverBolus}>
              <Text style={s.confirmBtnText}>Confirm & Deliver</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBolusModal(false)} style={{ padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#546480', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#0a0e1a' },
  scroll:   { flex: 1, paddingHorizontal: 16 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  greeting: { fontSize: 12, color: '#546480', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  name:     { fontSize: 24, fontWeight: '700', color: '#f0f4ff', letterSpacing: -0.5 },
  bolusQuickBtn: { backgroundColor: '#00d4aa', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  bolusQuickText: { color: '#000', fontWeight: '700', fontSize: 14 },

  connRow:  { flexDirection: 'row', gap: 8, marginBottom: 12 },
  connPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#151d2e', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)' },
  connPillActive: { borderColor: 'rgba(0,212,170,0.4)', backgroundColor: 'rgba(0,212,170,0.08)' },
  connDot:  { width: 6, height: 6, borderRadius: 3 },
  connDotActive: { backgroundColor: '#00d4aa' },
  connDotOff:    { backgroundColor: '#ff4757' },
  connText: { fontSize: 11, color: '#8a9bb5', fontWeight: '600' },

  heroCard: { backgroundColor: '#111d35', borderRadius: 24, padding: 20, marginBottom: 12, borderWidth: 0.5 },
  heroTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  heroLabel: { fontSize: 10, color: '#546480', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  heroValue: { fontSize: 58, fontWeight: '700', letterSpacing: -2, lineHeight: 62 },
  heroUnit:  { fontSize: 14, color: '#8a9bb5', fontWeight: '400', paddingBottom: 8 },
  heroSub:   { fontSize: 13, color: '#8a9bb5', marginTop: 4 },
  heroTIR:   { fontSize: 22, fontWeight: '700' },
  heroRange: { fontSize: 13, color: '#8a9bb5', marginTop: 2 },

  alarmBanner: { backgroundColor: 'rgba(255,71,87,0.15)', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 0.5, borderColor: '#ff4757' },
  alarmText:  { color: '#ff4757', fontWeight: '600', flex: 1 },
  alarmDismiss: { color: '#ff4757', fontWeight: '700' },

  suspendBanner: { backgroundColor: 'rgba(255,165,2,0.15)', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: '#ffa502', alignItems: 'center' },
  suspendText: { color: '#ffa502', fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#151d2e', borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)' },
  statLabel: { fontSize: 10, color: '#546480', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '700', marginTop: 4 },

  card: { backgroundColor: '#151d2e', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f0f4ff' },
  cardBadge: { fontSize: 10, color: '#00d4aa', fontWeight: '700', backgroundColor: 'rgba(0,212,170,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },

  deliveryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deliveryItem: { width: '48%', backgroundColor: '#1a2235', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)' },
  deliveryLabel: { fontSize: 11, color: '#546480', marginBottom: 3 },
  deliveryValue: { fontSize: 18, fontWeight: '700' },
  barBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: 8 },
  barFill: { height: 3, borderRadius: 2 },

  bolusBtn: { backgroundColor: '#00d4aa', borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 14 },
  bolusBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },

  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  summaryItem: { alignItems: 'center' },
  summaryVal:  { fontSize: 20, fontWeight: '700', color: '#00d4aa' },
  summaryLbl:  { fontSize: 10, color: '#546480', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111827', borderRadius: 28, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#f0f4ff', marginBottom: 16 },

  bolusInfo: { backgroundColor: '#1a2235', borderRadius: 14, padding: 14, marginBottom: 16 },
  bolusInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bolusInfoLbl: { fontSize: 13, color: '#546480' },
  bolusInfoVal: { fontSize: 13, fontWeight: '600' },

  doseDisplay: { fontSize: 52, fontWeight: '700', color: '#00d4aa', textAlign: 'center', letterSpacing: -1, marginVertical: 10 },
  doseUnit: { fontSize: 20, color: '#8a9bb5', fontWeight: '400' },

  stepRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 8 },
  stepBtn: { flex: 1, backgroundColor: '#1a2235', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  stepBtnText: { color: '#f0f4ff', fontWeight: '600', fontSize: 14 },

  confirmBtn: { backgroundColor: '#00d4aa', borderRadius: 16, padding: 17, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});

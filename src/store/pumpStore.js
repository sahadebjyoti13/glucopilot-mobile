/**
 * GlucoPilot — Global Pump State Store (Zustand)
 * Install: npm install zustand
 */

import { create } from 'zustand';

export const usePumpStore = create((set, get) => ({
  // ── Pump hardware state ──────────────────────────────────────────────────
  suspended:    false,
  basalRate:    0,
  iob:          0,
  reservoir:    300,
  totalToday:   0,
  lastBolus:    0,
  batteryPct:   100,
  alarmActive:  false,
  alarmMsg:     '',

  // ── Glucose ──────────────────────────────────────────────────────────────
  glucose:      null,   // mg/dL
  glucoseTrend: 0,      // mg/dL per min
  glucoseHistory: [],   // [{ value, ts }]

  // ── Connection ────────────────────────────────────────────────────────────
  backendConnected: false,
  esp32Connected:   false,
  insulinDecision:   null,

  // ── Patient profile (loaded after login) ─────────────────────────────────
  profile: {
    name: '', weight_kg: 0, height_cm: 0,
    tdd: 38, icr: 10, isf: 45,
    target_low: 70, target_high: 180, target_bg: 100,
    dia_hr: 4.5, insulin_type: 'Novorapid',
    cgm_type: 'Dexcom G7', algo: 'PID',
  },

  // ── Derived ──────────────────────────────────────────────────────────────
  inRange() {
    const { glucose, profile } = get();
    if (!glucose) return null;
    return glucose >= profile.target_low && glucose <= profile.target_high;
  },

  glucoseStatus() {
    const { glucose, profile } = get();
    if (!glucose) return 'unknown';
    if (glucose < profile.target_low)  return 'low';
    if (glucose > profile.target_high) return 'high';
    return 'normal';
  },

  trendArrow() {
    const t = get().glucoseTrend;
    if (t >  2) return '↑↑';
    if (t >  1) return '↑';
    if (t > 0.5) return '↗';
    if (t < -2) return '↓↓';
    if (t < -1) return '↓';
    if (t < -0.5) return '↘';
    return '→';
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  setPumpData(msg) {
    set({
      suspended:   msg.suspended   ?? get().suspended,
      basalRate:   msg.basalRate   ?? get().basalRate,
      iob:         msg.iob         ?? get().iob,
      reservoir:   msg.reservoir   ?? get().reservoir,
      totalToday:  msg.totalToday  ?? get().totalToday,
      lastBolus:   msg.lastBolus   ?? get().lastBolus,
      batteryPct:  msg.batteryPct  ?? get().batteryPct,
      alarmActive: msg.alarmActive ?? get().alarmActive,
      alarmMsg:    msg.alarmMsg    ?? get().alarmMsg,
    });
  },

  setGlucose({ value, trend = 0 }) {
    const now = Date.now();
    set(state => ({
      glucose:      value,
      glucoseTrend: trend,
      glucoseHistory: [
        ...state.glucoseHistory.slice(-287),  // keep last 24h (288 readings at 5min)
        { value, trend, ts: now },
      ],
    }));
  },

  setInsulinDecision(decision) {
    set({ insulinDecision: decision });
  },

  setConnections({ backend, esp32 } = {}) {
    set(state => ({
      backendConnected: backend ?? state.backendConnected,
      esp32Connected:   esp32   ?? state.esp32Connected,
    }));
  },

  setProfile(profile) {
    set({ profile: { ...get().profile, ...profile } });
  },

  addGlucoseHistory(readings) {
    set({ glucoseHistory: readings });
  },

  reset() {
    set({
      suspended: false, basalRate: 0, iob: 0,
      reservoir: 300, totalToday: 0, lastBolus: 0,
      glucose: null, glucoseTrend: 0, glucoseHistory: [],
      backendConnected: false, esp32Connected: false,
      insulinDecision: null,
    });
  },
}));

/**
 * GlucoPilot Mobile — API & Connection Service
 * React Native (Expo) — src/services/api.js
 *
 * Manages:
 *   - REST calls to backend server
 *   - WebSocket connection to backend (which relays to ESP32)
 *   - Direct ESP32 WebSocket for low-latency pump control
 *   - Token storage via AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Config — edit these to point at your actual servers ─────────────────────
const BACKEND_URL    = 'http://10.11.111.125:3000';  // Your backend server IP
const BACKEND_WS     = 'ws://192.168.1.100:3000/ws';
const ESP32_WS_URL   = 'ws://192.168.4.1:81';        // Direct ESP32 (when on pump WiFi)

// ─── Token helpers ────────────────────────────────────────────────────────────
export const TokenStore = {
  async get()          { return AsyncStorage.getItem('glucopilot_token'); },
  async set(t)         { return AsyncStorage.setItem('glucopilot_token', t); },
  async clear()        { return AsyncStorage.removeItem('glucopilot_token'); },
  async getPatientId() { return AsyncStorage.getItem('glucopilot_pid'); },
  async setPatientId(id) { return AsyncStorage.setItem('glucopilot_pid', id); },
};

// ─── REST API ─────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = await TokenStore.get();
  const res   = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'api_error');
  return data;
}

export const API = {
  // Auth
  async register(name, email, password) {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    await TokenStore.set(data.token);
    await TokenStore.setPatientId(data.patientId);
    return data;
  },

  async login(email, password) {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await TokenStore.set(data.token);
    await TokenStore.setPatientId(data.patientId);
    return data;
  },

  // Profile
  getProfile: ()         => apiFetch('/api/patient/profile'),
  updateProfile: (body)  => apiFetch('/api/patient/profile', { method: 'PUT', body: JSON.stringify(body) }),

  // Glucose
  postGlucose: (value, trend = 0, source = 'cgm') =>
    apiFetch('/api/glucose', { method: 'POST', body: JSON.stringify({ value, trend, source }) }),
  getGlucoseHistory: (limit = 288) =>
    apiFetch(`/api/glucose/history?limit=${limit}`),

  // Bolus
  postBolus: (units, type = 'manual') =>
    apiFetch('/api/bolus', { method: 'POST', body: JSON.stringify({ units, type }) }),
  getBolusHistory: () => apiFetch('/api/bolus/history'),

  // Stats
  getDailyStats: () => apiFetch('/api/stats/daily'),

  // Health
  ping: () => apiFetch('/health'),
};

// ─── WebSocket Manager ────────────────────────────────────────────────────────
class WSManager {
  constructor() {
    this.backendWs  = null;
    this.esp32Ws    = null;
    this.listeners  = new Map();  // event → Set of callbacks
    this.reconnectDelay = 3000;
    this._backendConnecting = false;
    this._esp32Connecting   = false;
  }

  // ── Subscribe to events ────────────────────────────────────────────────────
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event).delete(cb);  // unsubscribe
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => cb(data));
    this.listeners.get('*')?.forEach(cb => cb({ event, data }));
  }

  // ── Backend WebSocket ──────────────────────────────────────────────────────
  async connectBackend() {
    if (this._backendConnecting) return;
    this._backendConnecting = true;
    const token = await TokenStore.get();
    if (!token) { this._backendConnecting = false; return; }

    const url = `${BACKEND_WS}?token=${token}&role=mobile`;
    this.backendWs = new WebSocket(url);

    this.backendWs.onopen = () => {
      this._backendConnecting = false;
      this.emit('backend:connected', {});
      console.log('[WS] Backend connected');
    };

    this.backendWs.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        this.emit(`pump:${msg.type?.toLowerCase()}`, msg);
        this.emit('pump:any', msg);
      } catch (e) {
        console.warn('[WS] Bad message', e);
      }
    };

    this.backendWs.onerror = (e) => {
      this._backendConnecting = false;
      this.emit('backend:error', e);
    };

    this.backendWs.onclose = () => {
      this._backendConnecting = false;
      this.emit('backend:disconnected', {});
      setTimeout(() => this.connectBackend(), this.reconnectDelay);
    };
  }

  // ── Direct ESP32 WebSocket ─────────────────────────────────────────────────
  connectESP32() {
    if (this._esp32Connecting) return;
    this._esp32Connecting = true;
    this.esp32Ws = new WebSocket(ESP32_WS_URL);

    this.esp32Ws.onopen = () => {
      this._esp32Connecting = false;
      this.emit('esp32:connected', {});
      console.log('[WS] ESP32 direct connected');
      this.sendToESP32({ cmd: 'PING' });
    };

    this.esp32Ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        this.emit(`esp32:${msg.type?.toLowerCase()}`, msg);
        this.emit('esp32:any', msg);
      } catch {}
    };

    this.esp32Ws.onerror = () => {
      this._esp32Connecting = false;
      this.emit('esp32:error', {});
    };

    this.esp32Ws.onclose = () => {
      this._esp32Connecting = false;
      this.emit('esp32:disconnected', {});
      setTimeout(() => this.connectESP32(), this.reconnectDelay * 2);
    };
  }

  // ── Send helpers ───────────────────────────────────────────────────────────
  sendToBackend(obj) {
    if (this.backendWs?.readyState === WebSocket.OPEN) {
      this.backendWs.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  sendToESP32(obj) {
    if (this.esp32Ws?.readyState === WebSocket.OPEN) {
      this.esp32Ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  // Send via best available path
  sendCommand(cmd, params = {}) {
    const payload = { cmd, ...params };
    // Try direct ESP32 first (lower latency), fall back to backend relay
    if (!this.sendToESP32(payload)) {
      this.sendToBackend(payload);
    }
  }

  // ── Pump commands ──────────────────────────────────────────────────────────
  deliverBolus(units)    { this.sendCommand('BOLUS', { units }); }
  setBasalRate(rate)     { this.sendCommand('SET_BASAL', { rate }); }
  suspendPump(reason)    { this.sendCommand('SUSPEND', { reason }); }
  resumePump()           { this.sendCommand('RESUME'); }
  cancelAlarm()          { this.sendCommand('CANCEL_ALARM'); }
  getStatus()            { this.sendCommand('GET_STATUS'); }

  get backendConnected()  { return this.backendWs?.readyState === WebSocket.OPEN; }
  get esp32Connected()    { return this.esp32Ws?.readyState === WebSocket.OPEN; }

  // ── Connect both ──────────────────────────────────────────────────────────
  connectAll() {
    this.connectBackend();
    this.connectESP32();
  }

  disconnect() {
    this.backendWs?.close();
    this.esp32Ws?.close();
  }
}

export const WS = new WSManager();

// ─── Bolus calculator ─────────────────────────────────────────────────────────
export function calculateBolus({ currentBG, targetBG, carbsG, icr, isf, iob }) {
  const correctionBolus = (currentBG - targetBG) / isf;
  const mealBolus       = carbsG / icr;
  const totalBolus      = Math.max(0, correctionBolus + mealBolus - iob);
  return parseFloat(totalBolus.toFixed(1));
}

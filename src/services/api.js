/**
 * GlucoPilot Mobile — API & Connection Service
 * IP is now stored in AsyncStorage so it can be changed from Settings
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BACKEND_IP = '10.225.120.125';
const DEFAULT_ESP32_IP   = '192.168.4.1';

// ─── Config store ─────────────────────────────────────────────
export const Config = {
 async getBackendURL() {
  const ip = await AsyncStorage.getItem('backend_ip') || DEFAULT_BACKEND_IP;
  const prefix = ip.includes('onrender.com') ? 'https' : 'http';
  const port   = ip.includes('onrender.com') ? '' : ':3000';
  return `${prefix}://${ip}${port}`;
},
async getBackendWS() {
  const ip = await AsyncStorage.getItem('backend_ip') || DEFAULT_BACKEND_IP;
  const prefix = ip.includes('onrender.com') ? 'wss' : 'ws';
  const port   = ip.includes('onrender.com') ? '' : ':3000';
  return `${prefix}://${ip}${port}/ws`;
},
  async getESP32URL() {
    const ip = await AsyncStorage.getItem('esp32_ip') || DEFAULT_ESP32_IP;
    return `ws://${ip}:81`;
  },
  async setBackendIP(ip) {
    await AsyncStorage.setItem('backend_ip', ip.trim());
  },
  async setESP32IP(ip) {
    await AsyncStorage.setItem('esp32_ip', ip.trim());
  },
  async getBackendIP() {
    return await AsyncStorage.getItem('backend_ip') || DEFAULT_BACKEND_IP;
  },
  async getESP32IP() {
    return await AsyncStorage.getItem('esp32_ip') || DEFAULT_ESP32_IP;
  },
};

// ─── Token helpers ─────────────────────────────────────────────
export const TokenStore = {
  async get()            { return AsyncStorage.getItem('glucopilot_token'); },
  async set(t)           { return AsyncStorage.setItem('glucopilot_token', t); },
  async clear()          { return AsyncStorage.removeItem('glucopilot_token'); },
  async getPatientId()   { return AsyncStorage.getItem('glucopilot_pid'); },
  async setPatientId(id) { return AsyncStorage.setItem('glucopilot_pid', id); },
};

// ─── REST API ──────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const baseURL = await Config.getBackendURL();
  const token   = await TokenStore.get();
  const res = await fetch(`${baseURL}${path}`, {
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
  async register(name, email, password) {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST', body: JSON.stringify({ name, email, password }),
    });
    await TokenStore.set(data.token);
    await TokenStore.setPatientId(data.patientId);
    return data;
  },
  async login(email, password) {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    await TokenStore.set(data.token);
    await TokenStore.setPatientId(data.patientId);
    return data;
  },
  getProfile:       ()        => apiFetch('/api/patient/profile'),
  updateProfile:    (body)    => apiFetch('/api/patient/profile', { method: 'PUT', body: JSON.stringify(body) }),
  postGlucose:      (value, trend = 0, source = 'cgm') =>
    apiFetch('/api/glucose', { method: 'POST', body: JSON.stringify({ value, trend, source }) }),
  getGlucoseHistory:(limit=288) => apiFetch(`/api/glucose/history?limit=${limit}`),
  postBolus:        (units, type='manual') =>
    apiFetch('/api/bolus', { method: 'POST', body: JSON.stringify({ units, type }) }),
  getBolusHistory:  ()        => apiFetch('/api/bolus/history'),
  getDailyStats:    ()        => apiFetch('/api/stats/daily'),
  async ping() {
    const baseURL = await Config.getBackendURL();
    const res = await fetch(`${baseURL}/health`);
    return res.json();
  },
};

// ─── WebSocket Manager ─────────────────────────────────────────
class WSManager {
  constructor() {
    this.backendWs  = null;
    this.esp32Ws    = null;
    this.listeners  = new Map();
    this.reconnectDelay = 3000;
    this._backendConnecting = false;
    this._esp32Connecting   = false;
    this._shouldReconnect = true;
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event).delete(cb);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => cb(data));
    this.listeners.get('*')?.forEach(cb => cb({ event, data }));
  }

  async connectBackend() {
    this._shouldReconnect = true;
    if (this._backendConnecting) return;
    if (this.backendWs?.readyState === WebSocket.OPEN || this.backendWs?.readyState === WebSocket.CONNECTING) return;
    this._backendConnecting = true;
    const token = await TokenStore.get();
    if (!token) { this._backendConnecting = false; return; }
    const url = `${await Config.getBackendWS()}?token=${token}&role=mobile`;
    this.backendWs = new WebSocket(url);
    this.backendWs.onopen = () => {
      this._backendConnecting = false;
      this.emit('backend:connected', {});
    };
    this.backendWs.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        this.emit(`pump:${msg.type?.toLowerCase()}`, msg);
        this.emit('pump:any', msg);
      } catch {}
    };
    this.backendWs.onerror = () => { this._backendConnecting = false; this.emit('backend:error', {}); };
    this.backendWs.onclose = () => {
      this._backendConnecting = false;
      this.emit('backend:disconnected', {});
      if (this._shouldReconnect) setTimeout(() => this.connectBackend(), this.reconnectDelay);
    };
  }

  async connectESP32() {
    this._shouldReconnect = true;
    if (this._esp32Connecting) return;
    if (this.esp32Ws?.readyState === WebSocket.OPEN || this.esp32Ws?.readyState === WebSocket.CONNECTING) return;
    this._esp32Connecting = true;
    const url = await Config.getESP32URL();
    this.esp32Ws = new WebSocket(url);
    this.esp32Ws.onopen = () => {
      this._esp32Connecting = false;
      this.emit('esp32:connected', {});
      this.sendToESP32({ cmd: 'PING' });
    };
    this.esp32Ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        this.emit(`esp32:${msg.type?.toLowerCase()}`, msg);
        this.emit('esp32:any', msg);
      } catch {}
    };
    this.esp32Ws.onerror = () => { this._esp32Connecting = false; this.emit('esp32:error', {}); };
    this.esp32Ws.onclose = () => {
      this._esp32Connecting = false;
      this.emit('esp32:disconnected', {});
      if (this._shouldReconnect) setTimeout(() => this.connectESP32(), this.reconnectDelay * 2);
    };
  }

  sendToBackend(obj) {
    if (this.backendWs?.readyState === WebSocket.OPEN) {
      this.backendWs.send(JSON.stringify(obj)); return true;
    }
    return false;
  }

  sendToESP32(obj) {
    if (this.esp32Ws?.readyState === WebSocket.OPEN) {
      this.esp32Ws.send(JSON.stringify(obj)); return true;
    }
    return false;
  }

  sendCommand(cmd, params = {}) {
    const payload = { cmd, ...params };
    if (!this.sendToESP32(payload)) this.sendToBackend(payload);
  }

  deliverBolus(units)  { this.sendCommand('BOLUS',        { units }); }
  setBasalRate(rate)   { this.sendCommand('SET_BASAL',    { rate }); }
  suspendPump(reason)  { this.sendCommand('SUSPEND',      { reason }); }
  resumePump()         { this.sendCommand('RESUME'); }
  cancelAlarm()        { this.sendCommand('CANCEL_ALARM'); }
  getStatus()          { this.sendCommand('GET_STATUS'); }

  get backendConnected() { return this.backendWs?.readyState === WebSocket.OPEN; }
  get esp32Connected()   { return this.esp32Ws?.readyState  === WebSocket.OPEN; }

  connectAll() { this.connectBackend(); this.connectESP32(); }

  reconnectAll() {
    this.backendWs?.close();
    this.esp32Ws?.close();
    setTimeout(() => this.connectAll(), 500);
  }

  disconnect() {
    this._shouldReconnect = false;
    this._backendConnecting = false;
    this._esp32Connecting = false;
    this.backendWs?.close();
    this.esp32Ws?.close();
    this.backendWs = null;
    this.esp32Ws = null;
  }
}

export const WS = new WSManager();

export function calculateBolus({ currentBG, targetBG, carbsG, icr, isf, iob }) {
  const correction = (currentBG - targetBG) / isf;
  const meal       = carbsG / icr;
  return parseFloat(Math.max(0, correction + meal - iob).toFixed(1));
}

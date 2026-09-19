import { WS } from '../services/api';
import { usePumpStore } from '../store/pumpStore';

const TELEMETRY_INTERVAL_MS = 5000;

let lastSentAt = 0;

export function sendExerciseContext(context) {
  const now = Date.now();
  if (!context || now - lastSentAt < TELEMETRY_INTERVAL_MS) return false;

  const glucose = usePumpStore.getState().glucose;
  const glucoseTrend = usePumpStore.getState().glucoseTrend;

  const payload = {
    type: 'EXERCISE_CONTEXT',
    schemaVersion: '1.0.0',
    timestamp: now,
    context,
    cgm: {
      value: Number.isFinite(Number(glucose)) ? Number(glucose) : null,
      trend: Number.isFinite(Number(glucoseTrend)) ? Number(glucoseTrend) : null,
      source: 'MOBILE_STATE',
    },
  };

  const sent = WS.sendToBackend(payload);
  if (sent) lastSentAt = now;
  return sent;
}

export function resetExerciseTelemetry() {
  lastSentAt = 0;
}

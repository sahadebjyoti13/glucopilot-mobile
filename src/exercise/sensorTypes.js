/**
 * Canonical phone-side sensor types for the exercise-fusion runtime.
 * All timestamps are Unix epoch milliseconds.
 */

export const EXERCISE_STATES = Object.freeze({
  REST: 'REST',
  DETECTING: 'DETECTING',
  ACTIVE: 'ACTIVE',
  UNKNOWN: 'UNKNOWN',
});

export const ACTIVITIES = Object.freeze({ REST: 'REST', WALKING: 'WALKING', RUNNING: 'RUNNING', CYCLING: 'CYCLING', STRENGTH: 'STRENGTH', UNKNOWN: 'UNKNOWN' });

export const INTENSITIES = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  VIGOROUS: 'VIGOROUS',
});

export function makeExerciseContext(overrides = {}) {
  return {
    timestamp: Date.now(),
    state: EXERCISE_STATES.UNKNOWN,
    activity: ACTIVITIES.UNKNOWN,
    activityConfidence: 0,
    intensity: INTENSITIES.UNKNOWN,
    probability: 0,
    confidence: 0,
    durationSec: 0,
    cadenceSpm: 0,
    motionRms: 0,
    gyroRms: 0,
    dynamicAccelerationMean: 0,
    stepCount: 0,
    stepRatePerMin: 0,
    sampleCount: 0,
    windowDurationSec: 0,
    sensorQuality: {
      accelerometer: false,
      gyroscope: false,
      pedometer: false,
    },
    valid: false,
    source: 'PHONE_SENSOR_FUSION',
    algorithmVersion: '0.2.0',
    reason: 'Sensor fusion not started',
    ...overrides,
  };
}

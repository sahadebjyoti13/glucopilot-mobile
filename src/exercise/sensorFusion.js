import { makeExerciseContext } from './sensorTypes';

const DEFAULTS = Object.freeze({
  sampleRateHz: 20,
  windowSec: 10,
  minSamples: 100,
  gravityAlpha: 0.90,
});

function finite(value) {
  return Number.isFinite(value) ? value : null;
}

function magnitude(x, y, z) {
  if ([x, y, z].some(v => !Number.isFinite(v))) return null;
  return Math.sqrt(x * x + y * y + z * z);
}

function rms(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  return Math.sqrt(valid.reduce((sum, v) => sum + v * v, 0) / valid.length);
}

function mean(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/**
 * Real-time, phone-local sensor fusion.
 *
 * The engine deliberately emits CONTEXT only. It never calculates insulin
 * doses or pump commands. Accelerometer gravity is removed with a low-pass
 * estimate before motion features are calculated.
 */
export class PhoneSensorFusion {
  constructor(options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.maxSamples = Math.max(
      this.config.minSamples,
      Math.ceil(this.config.sampleRateHz * this.config.windowSec)
    );
    this.accel = [];
    this.gyro = [];
    this.gravity = { x: 0, y: 0, z: 0 };
    this.lastTimestamp = 0;
  }

  reset() {
    this.accel = [];
    this.gyro = [];
    this.gravity = { x: 0, y: 0, z: 0 };
    this.lastTimestamp = 0;
  }

  pushAccelerometer(sample) {
    const timestamp = Number(sample?.timestamp ?? Date.now());
    const x = finite(Number(sample?.x));
    const y = finite(Number(sample?.y));
    const z = finite(Number(sample?.z));
    if ([x, y, z].some(v => v === null)) return;

    // Exponential low-pass gravity estimate. Dynamic acceleration is the
    // residual after gravity removal; this makes the feature meaningful for
    // a phone in arbitrary orientation.
    const a = this.config.gravityAlpha;
    this.gravity.x = a * this.gravity.x + (1 - a) * x;
    this.gravity.y = a * this.gravity.y + (1 - a) * y;
    this.gravity.z = a * this.gravity.z + (1 - a) * z;

    const dx = x - this.gravity.x;
    const dy = y - this.gravity.y;
    const dz = z - this.gravity.z;
    const dynamicMagnitude = magnitude(dx, dy, dz);

    this.accel.push({ timestamp, dynamicMagnitude });
    this.trim();
  }

  pushGyroscope(sample) {
    const timestamp = Number(sample?.timestamp ?? Date.now());
    const x = finite(Number(sample?.x));
    const y = finite(Number(sample?.y));
    const z = finite(Number(sample?.z));
    if ([x, y, z].some(v => v === null)) return;

    this.gyro.push({ timestamp, magnitude: magnitude(x, y, z) });
    this.trim();
  }

  trim() {
    if (this.accel.length > this.maxSamples) this.accel.splice(0, this.accel.length - this.maxSamples);
    if (this.gyro.length > this.maxSamples) this.gyro.splice(0, this.gyro.length - this.maxSamples);
  }

  getFeatures() {
    const accelValues = this.accel.map(s => s.dynamicMagnitude);
    const gyroValues = this.gyro.map(s => s.magnitude);
    const allTimestamps = [
      ...this.accel.map(s => s.timestamp),
      ...this.gyro.map(s => s.timestamp),
    ].filter(Number.isFinite);

    const start = allTimestamps.length ? Math.min(...allTimestamps) : 0;
    const end = allTimestamps.length ? Math.max(...allTimestamps) : 0;
    const durationSec = start && end && end > start ? (end - start) / 1000 : 0;

    return {
      motionRms: rms(accelValues),
      gyroRms: rms(gyroValues),
      dynamicAccelerationMean: mean(accelValues),
      accelSamples: this.accel.length,
      gyroSamples: this.gyro.length,
      durationSec,
    };
  }

  update() {
    const f = this.getFeatures();
    const enoughAccel = f.accelSamples >= this.config.minSamples;
    const enoughGyro = f.gyroSamples >= this.config.minSamples;
    const valid = enoughAccel && enoughGyro;

    if (!valid) {
      return makeExerciseContext({
        timestamp: Date.now(),
        state: 'UNKNOWN',
        valid: false,
        sampleCount: Math.min(f.accelSamples, f.gyroSamples),
        windowDurationSec: f.durationSec,
        motionRms: f.motionRms,
        gyroRms: f.gyroRms,
        dynamicAccelerationMean: f.dynamicAccelerationMean,
        sensorQuality: {
          accelerometer: enoughAccel,
          gyroscope: enoughGyro,
        },
        reason: `Warming up: ${Math.min(f.accelSamples, f.gyroSamples)}/${this.config.minSamples} samples`,
      });
    }

    return makeExerciseContext({
      timestamp: Date.now(),
      valid: true,
      sampleCount: Math.min(f.accelSamples, f.gyroSamples),
      windowDurationSec: f.durationSec,
      motionRms: f.motionRms,
      gyroRms: f.gyroRms,
      dynamicAccelerationMean: f.dynamicAccelerationMean,
      sensorQuality: { accelerometer: true, gyroscope: true },
      reason: 'Features ready',
    });
  }
}

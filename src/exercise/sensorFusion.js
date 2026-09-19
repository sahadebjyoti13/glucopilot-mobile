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
    this.steps = [];
    this.pedometerAvailable = false;
  }

  reset() {
    this.accel = [];
    this.gyro = [];
    this.gravity = { x: 0, y: 0, z: 0 };
    this.steps = [];
  }

  pushAccelerometer(sample) {
    const timestamp = Number(sample?.timestamp ?? Date.now());
    const x = finite(Number(sample?.x));
    const y = finite(Number(sample?.y));
    const z = finite(Number(sample?.z));
    if ([x, y, z].some(v => v === null)) return;

    const a = this.config.gravityAlpha;
    this.gravity.x = a * this.gravity.x + (1 - a) * x;
    this.gravity.y = a * this.gravity.y + (1 - a) * y;
    this.gravity.z = a * this.gravity.z + (1 - a) * z;

    const dx = x - this.gravity.x;
    const dy = y - this.gravity.y;
    const dz = z - this.gravity.z;
    this.accel.push({ timestamp, dynamicMagnitude: magnitude(dx, dy, dz) });
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

  setPedometerAvailable(available) {
    this.pedometerAvailable = Boolean(available);
  }

  pushSteps(sample) {
    const timestamp = Number(sample?.timestamp ?? Date.now());
    const count = Number(sample?.count);
    if (!Number.isFinite(count) || count < 0) return;
    this.steps.push({ timestamp, count });
    this.steps = this.steps.slice(-20);
  }

  trim() {
    if (this.accel.length > this.maxSamples) this.accel.splice(0, this.accel.length - this.maxSamples);
    if (this.gyro.length > this.maxSamples) this.gyro.splice(0, this.gyro.length - this.maxSamples);
  }

  getStepFeatures() {
    if (this.steps.length < 2) return { count: 0, ratePerMin: 0, valid: false };
    const first = this.steps[0];
    const last = this.steps[this.steps.length - 1];
    const dtMin = (last.timestamp - first.timestamp) / 60000;
    const delta = Math.max(0, last.count - first.count);
    return {
      count: last.count,
      ratePerMin: dtMin > 0 ? delta / dtMin : 0,
      valid: dtMin > 0,
    };
  }

  getFeatures() {
    const accelValues = this.accel.map(s => s.dynamicMagnitude);
    const gyroValues = this.gyro.map(s => s.magnitude);
    const allTimestamps = [...this.accel, ...this.gyro].map(s => s.timestamp).filter(Number.isFinite);
    const start = allTimestamps.length ? Math.min(...allTimestamps) : 0;
    const end = allTimestamps.length ? Math.max(...allTimestamps) : 0;
    const durationSec = start && end && end > start ? (end - start) / 1000 : 0;
    const stepFeatures = this.getStepFeatures();

    return {
      motionRms: rms(accelValues),
      gyroRms: rms(gyroValues),
      dynamicAccelerationMean: mean(accelValues),
      accelSamples: this.accel.length,
      gyroSamples: this.gyro.length,
      durationSec,
      stepCount: stepFeatures.count,
      stepRatePerMin: stepFeatures.ratePerMin,
      pedometerValid: stepFeatures.valid,
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
        stepCount: f.stepCount,
        stepRatePerMin: f.stepRatePerMin,
        sensorQuality: {
          accelerometer: enoughAccel,
          gyroscope: enoughGyro,
          pedometer: this.pedometerAvailable,
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
      stepCount: f.stepCount,
      stepRatePerMin: f.stepRatePerMin,
      sensorQuality: {
        accelerometer: true,
        gyroscope: true,
        pedometer: this.pedometerAvailable,
      },
      reason: 'Features ready',
    });
  }
}

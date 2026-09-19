import { EXERCISE_STATES, ACTIVITIES, INTENSITIES, makeExerciseContext } from './sensorTypes';

const DEFAULTS = Object.freeze({
  motionOnThreshold: 0.35,
  motionOffThreshold: 0.20,
  gyroOnThreshold: 0.30,
  gyroOffThreshold: 0.18,
  onWindows: 2,
  offWindows: 3,
  maxGapMs: 3000,
  walkingCadenceMin: 50,
  runningCadenceMin: 150,
});

export class ExerciseDetector {
  constructor(options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.state = EXERCISE_STATES.REST;
    this.onCount = 0;
    this.offCount = 0;
    this.lastTimestamp = 0;
    this.activeSince = 0;
  }

  reset() {
    this.state = EXERCISE_STATES.REST;
    this.onCount = 0;
    this.offCount = 0;
    this.lastTimestamp = 0;
    this.activeSince = 0;
  }

  update(features) {
    if (!features?.valid) {
      return makeExerciseContext({
        ...features,
        state: EXERCISE_STATES.UNKNOWN,
        activity: ACTIVITIES.UNKNOWN,
        intensity: INTENSITIES.UNKNOWN,
        probability: 0,
        confidence: 0,
        activityConfidence: 0,
        durationSec: 0,
        cadenceSpm: 0,
        reason: features?.reason || 'Invalid sensor data',
      });
    }

    const now = Number(features.timestamp || Date.now());
    if (this.lastTimestamp && now - this.lastTimestamp > this.config.maxGapMs) {
      this.reset();
    }
    this.lastTimestamp = now;

    const motion = Number(features.motionRms) || 0;
    const gyro = Number(features.gyroRms) || 0;

    const onEvidence = motion >= this.config.motionOnThreshold || gyro >= this.config.gyroOnThreshold;
    const offEvidence = motion <= this.config.motionOffThreshold && gyro <= this.config.gyroOffThreshold;

    if (this.state === EXERCISE_STATES.REST) {
      this.offCount = 0;
      this.onCount = onEvidence ? this.onCount + 1 : 0;
      if (this.onCount >= this.config.onWindows) {
        this.state = EXERCISE_STATES.ACTIVE;
        this.activeSince = now;
        this.onCount = 0;
      }
    } else {
      this.onCount = 0;
      this.offCount = offEvidence ? this.offCount + 1 : 0;
      if (this.offCount >= this.config.offWindows) {
        this.state = EXERCISE_STATES.REST;
        this.offCount = 0;
        this.activeSince = 0;
      }
    }

    const probability = this.estimateProbability(motion, gyro);
    const intensity = this.state === EXERCISE_STATES.ACTIVE
      ? this.estimateIntensity(motion, gyro)
      : INTENSITIES.UNKNOWN;
    const cadence = Number(features.stepRatePerMin) || 0;
    const activityResult = this.classifyActivity(cadence, motion, gyro);
    const durationSec = this.state === EXERCISE_STATES.ACTIVE && this.activeSince
      ? Math.max(0, (now - this.activeSince) / 1000)
      : 0;

    return makeExerciseContext({
      ...features,
      timestamp: now,
      state: this.state,
      activity: this.state === EXERCISE_STATES.ACTIVE ? activityResult.activity : ACTIVITIES.REST,
      activityConfidence: this.state === EXERCISE_STATES.ACTIVE ? activityResult.confidence : 1,
      intensity,
      probability,
      confidence: this.state === EXERCISE_STATES.ACTIVE ? probability : 1 - probability,
      durationSec,
      cadenceSpm: cadence,
      reason: this.state === EXERCISE_STATES.ACTIVE ? activityResult.reason : 'Motion below activity threshold',
    });
  }

  classifyActivity(cadence, motion, gyro) {
    // Conservative v0.2 heuristic. Without a usable cadence signal, the
    // current sensor set does not claim to distinguish cycling from strength.
    if (cadence >= this.config.runningCadenceMin) {
      return {
        activity: ACTIVITIES.RUNNING,
        confidence: Math.min(0.98, 0.70 + Math.min(0.25, (cadence - 150) / 400)),
        reason: 'Sustained activity with running-range cadence',
      };
    }
    if (cadence >= this.config.walkingCadenceMin) {
      return {
        activity: ACTIVITIES.WALKING,
        confidence: 0.80,
        reason: 'Sustained activity with walking-range cadence',
      };
    }
    return {
      activity: ACTIVITIES.UNKNOWN,
      confidence: 0.35,
      reason: 'Exercise detected; activity type not yet classified',
    };
  }

  estimateProbability(motion, gyro) {
    const m = Math.min(1, motion / Math.max(this.config.motionOnThreshold, 0.001));
    const g = Math.min(1, gyro / Math.max(this.config.gyroOnThreshold, 0.001));
    return Number((0.65 * m + 0.35 * g).toFixed(3));
  }

  estimateIntensity(motion, gyro) {
    const score = 0.65 * motion / Math.max(this.config.motionOnThreshold, 0.001)
      + 0.35 * gyro / Math.max(this.config.gyroOnThreshold, 0.001);
    if (score >= 2.0) return INTENSITIES.VIGOROUS;
    if (score >= 1.0) return INTENSITIES.MODERATE;
    return INTENSITIES.LOW;
  }
}

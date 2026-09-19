import { Accelerometer, Gyroscope, Pedometer } from 'expo-sensors';
import { PhoneSensorFusion } from './sensorFusion';
import { ExerciseDetector } from './exerciseDetector';

const UPDATE_INTERVAL_MS = 50; // 20 Hz

export class ExerciseService {
  constructor({ onContext, onError } = {}) {
    this.onContext = onContext;
    this.onError = onError;
    this.fusion = new PhoneSensorFusion({ sampleRateHz: 20, windowSec: 10, minSamples: 100 });
    this.detector = new ExerciseDetector();
    this.accelSubscription = null;
    this.gyroSubscription = null;
    this.pedometerSubscription = null;
    this.running = false;
  }

  async start() {
    if (this.running) return;
    try {
      const [accelAvailable, gyroAvailable] = await Promise.all([
        Accelerometer.isAvailableAsync(),
        Gyroscope.isAvailableAsync(),
      ]);

      if (!accelAvailable || !gyroAvailable) {
        throw new Error(`Required sensors unavailable (accelerometer=${accelAvailable}, gyroscope=${gyroAvailable})`);
      }

      let pedometerAvailable = false;
      try {
        const permission = await Pedometer.getPermissionsAsync();
        const granted = permission?.granted
          ? true
          : (await Pedometer.requestPermissionsAsync())?.granted === true;

        if (granted) {
          pedometerAvailable = await Pedometer.isAvailableAsync();
        }
      } catch (pedometerError) {
        // Pedometer is an optional context sensor. Motion fusion continues
        // when the platform does not expose it or permission is unavailable.
        this.onError?.(new Error(`Pedometer unavailable: ${pedometerError.message}`));
      }

      this.fusion.reset();
      this.fusion.setPedometerAvailable(pedometerAvailable);
      this.detector.reset();
      this.running = true;

      Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      Gyroscope.setUpdateInterval(UPDATE_INTERVAL_MS);

      this.accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
        this.fusion.pushAccelerometer({ x, y, z, timestamp: Date.now() });
        this.publish();
      });

      this.gyroSubscription = Gyroscope.addListener(({ x, y, z }) => {
        this.fusion.pushGyroscope({ x, y, z, timestamp: Date.now() });
        this.publish();
      });

      if (pedometerAvailable) {
        this.pedometerSubscription = Pedometer.watchStepCount(({ steps }) => {
          this.fusion.pushSteps({ count: steps, timestamp: Date.now() });
          this.publish();
        });
      }
    } catch (error) {
      this.running = false;
      this.onError?.(error);
      throw error;
    }
  }

  publish() {
    if (!this.running) return;
    const context = this.detector.update(this.fusion.update());
    this.onContext?.(context);
  }

  stop() {
    this.running = false;
    this.accelSubscription?.remove();
    this.gyroSubscription?.remove();
    this.pedometerSubscription?.remove();
    this.accelSubscription = null;
    this.gyroSubscription = null;
    this.pedometerSubscription = null;
  }
}

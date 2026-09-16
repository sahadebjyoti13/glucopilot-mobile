# Phone Exercise Sensor Fusion

This module is the phone-side contextual exercise detector for GlucoPilot.

## Current inputs

- Accelerometer at 20 Hz.
- Gyroscope at 20 Hz.
- Pedometer when the platform exposes it.

The accelerometer is converted to dynamic acceleration by subtracting a low-pass gravity estimate. A rolling 10 s window is used for motion and angular-velocity features. The detector uses persistence/hysteresis so a single noisy sensor sample does not toggle the state.

## Output

`ExerciseContext` contains:

- `state`: `UNKNOWN`, `REST`, or `ACTIVE`
- `activity`
- `intensity`
- `probability`
- `confidence`
- motion and gyroscope features
- step count/rate when available
- sensor-quality flags
- timestamp and algorithm version

The module deliberately does **not** calculate insulin doses and does **not** send pump commands.

## First physical test

1. Install dependencies with the Expo-compatible installer:
   `npx expo install expo-sensors`
2. Start the application on a physical phone. Motion sensors are not meaningfully testable on a simulator.
3. Open the **Exercise** tab.
4. Keep the phone stationary until the 10 s warm-up completes.
5. Walk continuously for 1–2 minutes with the phone in a consistent position.
6. Stop and remain still for at least 15–20 s.
7. Observe `RESTING → EXERCISE ACTIVE → RESTING` and record the displayed motion/gyro/step telemetry.

## Important implementation boundary

This is a research/context layer. It is not a clinically validated exercise classifier and must not be used by itself to determine insulin delivery.

The current detector is intentionally a deterministic motion baseline. A trained activity model, patient-independent evaluation, sensor-dropout tests, and clinical/real-world validation are separate work items.

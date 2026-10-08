# GlucoPilot Mobile 🩺

Patient-side React Native application for the **GlucoPilot networked insulin-delivery research platform**.

> **Research status:** GlucoPilot Mobile is a research/prototype application and is **not a clinically validated medical device**. The exercise module supplies contextual information only; it does not directly calculate insulin doses or issue pump commands.

## Role in the system

The mobile application provides:

- patient-facing glucose and pump information
- authentication and application state
- phone-based physical-activity sensing
- exercise-context generation
- research telemetry exchange with the backend
- display of research decision telemetry

The mobile exercise module is intentionally separated from therapeutic actuation.

```
Phone sensors
   ├── Accelerometer
   ├── Gyroscope
   └── Pedometer (when supported)
          ↓
     Sensor fusion
          ↓
   Exercise detector
          ↓
   ExerciseContext
          ↓
   EXERCISE_CONTEXT
          ↓
      Backend
          ↓
Research decision telemetry
          ↓
Mobile display / persistence
```

---

## Exercise sensor-fusion pipeline

The phone-side pipeline combines available motion sensors and optional pedometer information.

### Inputs

- Accelerometer
- Gyroscope
- Pedometer/step data where supported

### Processing

1. Sensor acquisition
2. Sensor availability/quality handling
3. Rolling-window processing
4. Gravity compensation
5. Motion-feature extraction
6. Sensor fusion
7. Activity/state classification
8. Structured ExerciseContext generation

The context can include:

- exercise state
- detected activity
- intensity
- exercise probability
- activity confidence
- duration
- cadence/step rate
- step count
- sensor quality
- algorithm version
- research diagnostics

Unknown or insufficiently supported activities should remain **UNKNOWN** rather than being fabricated.

The current classifier is a prototype heuristic and is **not clinically validated**.

---

## Communication with the backend

Exercise context is sent using the structured message:

```text
EXERCISE_CONTEXT
```

The backend may combine this contextual information with CGM information and generate research-only decision telemetry.

The resulting telemetry is displayed/stored for development and validation.

### Important boundary

```
ExerciseContext
      ↓
Research context/decision layer
      ↓
Safety architecture
      ↓
Pump communication
```

The exercise detector itself must **never** directly call:

- bolus delivery
- basal-rate commands
- pump suspension/resume
- motor commands

The current research decision telemetry uses actuationEligible: false.

This field should not be interpreted as a substitute for an independent hardware/software safety interlock.

---

## Project structure

```
glucopilot-mobile/
├── App.js
├── app.json
├── package.json
├── assets/
└── src/
    ├── exercise/
    │   ├── exerciseDetector.js
    │   ├── exerciseService.js
    │   ├── exerciseTelemetry.js
    │   ├── sensorFusion.js
    │   └── sensorTypes.js
    ├── screens/
    │   └── ExerciseScreen.js
    ├── services/
    │   └── api.js
    └── store/
        └── pumpStore.js
```

### Important files

| File | Responsibility |
|---|---|
| exerciseService.js | Starts/stops phone sensors and feeds sensor data into the exercise pipeline |
| sensorFusion.js | Rolling-window processing, motion features, gravity handling and sensor fusion |
| exerciseDetector.js | Generates exercise/activity/intensity context |
| sensorTypes.js | Canonical context/state/activity/intensity structures |
| exerciseTelemetry.js | Sends structured exercise context to the backend |
| ExerciseScreen.js | Displays exercise context and research decision telemetry |
| services/api.js | REST/WebSocket connectivity and command transport |
| store/pumpStore.js | Global mobile application/pump state |

---

## Requirements

- Node.js and npm
- Expo SDK 54-compatible environment
- Android or iOS device
- Compatible Expo Go installation for development
- Local network connectivity to the backend for local development

The complete GlucoPilot system additionally requires the backend, MQTT broker, PostgreSQL service and, where applicable, the ESP32 pump device.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

The project uses Expo SDK 54 and expo-sensors.

### 2. Configure the backend

Configure the backend address for the active development network.

Do not treat a developer LAN IP as a permanent deployment address.

The application also supports a persisted backend address through its configuration mechanism. If an old backend address has previously been stored, it may take precedence over the source-code default.

### 3. Start Expo

```bash
npx expo start
```

Use a compatible Expo Go installation or development build.

### 4. Start the backend separately

From the GlucoPilot backend repository:

```bash
npm install
node server.js
```

Verify the backend health endpoint before troubleshooting mobile connectivity:

```text
http://<backend-host>:3000/health
```

---

## Exercise testing

Open the exercise interface and verify:

- accelerometer status
- gyroscope status
- pedometer status where supported
- exercise-engine status
- activity
- intensity
- duration
- cadence
- steps
- exercise probability
- activity confidence

Walk and perform controlled movement for development testing. The detector should transition between rest and active states when sufficient sensor evidence is available.

If the pedometer API is unavailable, motion sensing can continue using the available sensors.

For rigorous research validation, use recorded datasets and predefined ground truth rather than relying only on visual inspection of the UI.

---

## Research decision telemetry

The mobile application can receive and display structured decision telemetry from the backend.

The current research layer includes fields such as:

- CGM value
- glucose trend
- target BG
- ISF
- IOB
- exercise context
- research correction estimate
- calibration state
- actuation eligibility

The current exercise adjustment factor is **1.0** and is explicitly not clinically calibrated. Exercise context therefore does not currently alter the numerical insulin correction estimate.

This is intentional: the software currently provides the infrastructure for context-aware algorithm research without asserting a clinically validated exercise-dose relationship.

---

## Safety boundary

The following separation must be preserved during development:

```
Sensor acquisition
      ↓
ExerciseContext
      ↓
Context/decision telemetry
      ↓
Independent safety architecture
      ↓
Pump communication
```

Do not place therapeutic dosing logic inside the exercise detector.

Any future dosing integration requires:

- independently defined safety constraints
- stale-data handling
- sensor-fault handling
- communication-loss handling
- command authorization
- pump-state verification
- quantitative algorithm validation
- hardware-in-the-loop testing
- appropriate research/clinical protocols

---

## Current status

| Capability | Status |
|---|---|
| Mobile authentication/navigation | Implemented |
| Backend/WebSocket connectivity | Implemented |
| Accelerometer sensing | Implemented |
| Gyroscope sensing | Implemented |
| Sensor fusion | Implemented |
| Structured exercise context | Implemented |
| Exercise telemetry | Implemented |
| Exercise UI | Implemented |
| Pedometer capability handling | Implemented |
| Decision telemetry reception/display | Implemented |
| Clinically validated activity classifier | **Not implemented** |
| Clinically validated insulin-dose model | **Not implemented** |
| Clinical validation | **Not performed** |

---

## Development principles

Keep the following subsystems modular:

- sensor acquisition
- feature extraction
- sensor fusion
- activity classification
- exercise-context generation
- telemetry transport
- UI
- decision/control logic
- pump communication
- safety supervision

The mobile exercise subsystem should remain independently testable and must not become a hidden insulin-actuation path.

---

## License

See the repository license before redistribution.

Research project by **Debjyoti Saha, IIEST Shibpur**.

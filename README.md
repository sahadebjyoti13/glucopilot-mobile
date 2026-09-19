# GlucoPilot Mobile

GlucoPilot Mobile is the patient-side mobile application for the **GlucoPilot networked insulin-delivery research platform**.

Its job is to provide a human-friendly interface for the patient while collecting contextual information from the phone, including physical-activity signals. The current implementation contains a phone-side exercise sensor-fusion pipeline that combines accelerometer, gyroscope and, where supported, Android/iOS pedometer data.

> **Research status:** This is a research/prototype system, not a clinically validated medical device. Exercise detection currently provides contextual information only and does not directly calculate insulin doses or issue pump commands.

## What it is for

The long-term GlucoPilot architecture is intended to combine:

- continuous glucose information,
- physical-activity context,
- meal context,
- pump telemetry,
- safety supervision, and
- a separate control/decision layer

to support research into **networked, context-aware closed-loop insulin delivery**.

The mobile application is therefore designed as the patient-facing context and monitoring layer rather than as an uncontrolled direct dosing interface.

## Current exercise pipeline

The current phone-side pipeline is:

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
 Structured ExerciseContext
          ↓
     Mobile UI
```

The structured context contains human-readable information such as:

- exercise state,
- detected activity,
- activity confidence,
- intensity,
- exercise probability,
- duration,
- cadence/step rate,
- step count,
- sensor quality,
- algorithm version.

Raw motion quantities such as RMS acceleration and gyroscope RMS remain available under the research diagnostics section for development and validation.

### Activity classification

The current classifier is intentionally conservative. It can use cadence together with motion and gyroscope features to distinguish common states such as walking and running. Activities that cannot be reliably inferred from the available signals are reported as **UNKNOWN** rather than being fabricated.

This is a prototype heuristic and is **not yet a clinically validated activity-recognition model**.

### Pedometer support

Pedometer support is implemented as an optional sensor capability.

If the device/OS exposes the Pedometer API and the required permission is granted, step data are incorporated into the exercise context. If it is unavailable, accelerometer/gyroscope-based sensing can continue.

Therefore, the application does not assume that every phone has an accessible Pedometer API.

## Project structure

```
glucopilot-mobile/
├── App.js
├── app.json
├── package.json
├── .env.example
├── assets/
└── src/
    ├── exercise/
    │   ├── exerciseDetector.js
    │   ├── exerciseService.js
    │   ├── sensorFusion.js
    │   └── sensorTypes.js
    ├── screens/
    ├── services/
    └── store/
```

### Important exercise files

**`exerciseService.js`**  
Starts/stops phone sensors and connects sensor streams to the fusion engine.

**`sensorFusion.js`**  
Maintains the rolling sensor window, removes the gravity component from acceleration, calculates motion features, and incorporates step information.

**`exerciseDetector.js`**  
Converts the fused features into the structured exercise state/activity/intensity context.

**`sensorTypes.js`**  
Defines the canonical exercise states, activities, intensities and `ExerciseContext` structure.

**`ExerciseScreen.js`**  
Displays the human-readable exercise context and research diagnostics.

## Requirements

- Node.js and npm
- Expo SDK 54-compatible environment
- Android or iOS phone
- Expo Go compatible with the project's Expo SDK for development
- Phone and development computer on the same local network when using the local Metro/backend setup
- For the complete GlucoPilot system, the separate GlucoPilot backend must also be running

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/sahadebjyoti13/glucopilot-mobile.git
cd glucopilot-mobile
```

### 2. Install dependencies

```bash
npm install
```

The project uses Expo SDK 54 and `expo-sensors`.

### 3. Configure the backend address

Copy the example environment file:

```bash
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Set the backend address appropriate for the development machine/network:

```text
BACKEND_URL=http://YOUR_SERVER_IP:3000
ESP32_IP=192.168.4.1
```

Do not commit private credentials or machine-specific secrets.

> The current application also contains development-time networking defaults in the API service. For a new deployment, configure the backend address explicitly rather than assuming the developer's LAN IP.

### 4. Start the backend

The mobile application expects the GlucoPilot backend to be available separately.

From the backend project:

```bash
npm install
npm start
```

The local backend normally exposes the API on port `3000`.

Verify that the backend health endpoint responds before debugging mobile login/network problems.

### 5. Start Expo

From this repository:

```bash
npx expo start
```

Expo will display a QR code and a local development URL.

Open the project in a compatible Expo Go installation.

### 6. Development workflow

You normally **do not need to restart Metro after every JavaScript change**.

Keep:

```
Terminal 1 → Backend
Terminal 2 → Expo / Metro
```

Save a JavaScript/React file and allow Expo Fast Refresh to update the application.

Use:

```bash
npx expo start -c
```

only when a stale/corrupted Metro cache is suspected or when a clean bundling cycle is required.

## Testing the exercise screen

Open:

**Exercise → Exercise Context**

Check:

- Accelerometer status
- Gyroscope status
- Pedometer status
- Exercise engine status
- Activity
- Intensity
- Duration
- Cadence
- Steps
- Exercise probability
- Activity confidence

Walk for several minutes and observe the transition between rest and active movement. Running should produce a different activity classification when the available sensor evidence is sufficient.

If Pedometer is unavailable on a particular phone, this does not automatically mean that the exercise engine has failed; the application is designed to retain motion sensing through the other available sensors.

## Safety and architecture

The exercise module is intentionally separated from insulin dosing.

The intended system boundary is:

```
ExerciseContext
      ↓
Context-aware decision/control module
      ↓
Safety supervisor
      ↓
Pump communication
      ↓
Insulin pump
```

The exercise detector itself must **not** directly call insulin delivery, basal-rate or bolus functions.

Any future insulin-decision implementation requires independent safety constraints, validation and appropriate research/clinical protocols before it could be considered for real-world therapeutic use.

## Development mission

GlucoPilot is being developed as a research platform for exploring how **real-time physiological data, physical activity, meal context, embedded control and networked telemetry** can be brought together in a modular closed-loop architecture.

The goal is not simply to display sensor readings. The goal is to create a clear software architecture in which each subsystem has a defined responsibility, measurable inputs/outputs, safety boundaries and a path toward rigorous validation.

## Current status

- Mobile authentication and navigation: implemented
- Backend/WebSocket connectivity: implemented
- Phone accelerometer sensing: implemented
- Phone gyroscope sensing: implemented
- Phone sensor fusion: implemented
- Structured exercise context: implemented
- Human-readable exercise UI: implemented
- Pedometer capability detection and integration: implemented
- Validated multi-activity ML classifier: **not yet implemented**
- Insulin decision/control module: **separate future module**
- Clinical validation: **not performed**

## Contributing

Keep changes modular and testable. Sensor acquisition, feature extraction, activity classification, UI, communication and insulin-control logic should remain separated.

Do not add therapeutic dosing logic to the exercise detector.

## License

Add the project's intended license before public redistribution.

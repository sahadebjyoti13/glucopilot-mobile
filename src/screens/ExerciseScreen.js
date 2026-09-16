import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { ExerciseService } from '../exercise/exerciseService';
import { useExerciseStore } from '../store/exerciseStore';

const stateLabel = {
  REST: 'RESTING',
  DETECTING: 'DETECTING',
  ACTIVE: 'EXERCISE ACTIVE',
  UNKNOWN: 'UNKNOWN',
};

function Metric({ label, value, unit = '' }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}{unit ? ` ${unit}` : ''}</Text>
    </View>
  );
}

export default function ExerciseScreen() {
  const running = useExerciseStore(s => s.running);
  const error = useExerciseStore(s => s.error);
  const context = useExerciseStore(s => s.context);
  const setRunning = useExerciseStore(s => s.setRunning);
  const setError = useExerciseStore(s => s.setError);
  const setContext = useExerciseStore(s => s.setContext);

  useEffect(() => {
    const service = new ExerciseService({
      onContext: setContext,
      onError: errorValue => setError(errorValue?.message || errorValue),
    });

    service.start()
      .then(() => setRunning(true))
      .catch(() => setRunning(false));

    return () => {
      service.stop();
      setRunning(false);
    };
  }, [setContext, setError, setRunning]);

  const state = context.state;
  const active = state === 'ACTIVE';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>GLUCOPILOT · SENSOR FUSION</Text>
      <Text style={styles.title}>Exercise Monitor</Text>
      <Text style={styles.subtitle}>Phone-local motion analysis. Context only.</Text>

      <View style={[styles.stateCard, active && styles.activeCard]}>
        <View style={styles.dot} />
        <Text style={styles.stateText}>{stateLabel[state] || state}</Text>
        <Text style={styles.activity}>{context.activity}</Text>
        <Text style={styles.confidence}>{Math.round((context.confidence || 0) * 100)}% confidence</Text>
      </View>

      <View style={styles.grid}>
        <Metric label="Intensity" value={context.intensity} />
        <Metric label="Probability" value={`${Math.round((context.probability || 0) * 100)}%`} />
        <Metric label="Motion RMS" value={Number(context.motionRms || 0).toFixed(3)} />
        <Metric label="Gyro RMS" value={Number(context.gyroRms || 0).toFixed(3)} />
        <Metric label="Dynamic accel" value={Number(context.dynamicAccelerationMean || 0).toFixed(3)} />
        <Metric label="Samples" value={context.sampleCount || 0} />
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.sectionTitle}>Sensor status</Text>
        <Text style={styles.row}>Accelerometer <Text style={styles.ok}>{context.sensorQuality?.accelerometer ? 'AVAILABLE' : 'WAITING'}</Text></Text>
        <Text style={styles.row}>Gyroscope <Text style={styles.ok}>{context.sensorQuality?.gyroscope ? 'AVAILABLE' : 'WAITING'}</Text></Text>
        <Text style={styles.row}>Engine <Text style={styles.ok}>{running ? 'RUNNING' : 'STOPPED'}</Text></Text>
      </View>

      {!context.valid && <Text style={styles.info}>{context.reason}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>RESEARCH MODE</Text>
        <Text style={styles.noticeText}>
          Exercise detection is a contextual signal. This screen does not calculate insulin doses or send pump commands.
        </Text>
      </View>

      <Pressable style={styles.resetButton} onPress={() => setError(null)}>
        <Text style={styles.resetText}>Clear status</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 28, backgroundColor: '#0a0e1a', flexGrow: 1 },
  eyebrow: { color: '#00d4aa', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#f0f4ff', fontSize: 30, fontWeight: '800', marginTop: 8 },
  subtitle: { color: '#7d8ba6', fontSize: 13, marginTop: 6, marginBottom: 18 },
  stateCard: { backgroundColor: '#111827', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 16 },
  activeCard: { borderColor: '#00d4aa' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#00d4aa', marginBottom: 12 },
  stateText: { color: '#f0f4ff', fontSize: 24, fontWeight: '800' },
  activity: { color: '#00d4aa', fontSize: 15, fontWeight: '700', marginTop: 5 },
  confidence: { color: '#8c9ab3', marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  metric: { width: '48%', minHeight: 82, backgroundColor: '#111827', borderRadius: 14, padding: 14 },
  metricLabel: { color: '#73819a', fontSize: 11 },
  metricValue: { color: '#f0f4ff', fontSize: 18, fontWeight: '700', marginTop: 8 },
  statusCard: { backgroundColor: '#111827', borderRadius: 16, padding: 16 },
  sectionTitle: { color: '#f0f4ff', fontWeight: '700', marginBottom: 10 },
  row: { color: '#aeb9cc', paddingVertical: 5 },
  ok: { color: '#00d4aa', fontWeight: '700' },
  info: { color: '#8795ad', marginTop: 12 },
  error: { color: '#ff6b7a', marginTop: 12 },
  notice: { marginTop: 18, padding: 15, borderRadius: 14, backgroundColor: '#171d2b' },
  noticeTitle: { color: '#f0f4ff', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  noticeText: { color: '#8f9bb0', fontSize: 12, lineHeight: 18, marginTop: 6 },
  resetButton: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 10, paddingHorizontal: 14 },
  resetText: { color: '#00d4aa', fontWeight: '700' },
});

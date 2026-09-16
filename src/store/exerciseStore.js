import { create } from 'zustand';
import { makeExerciseContext } from '../exercise/sensorTypes';

export const useExerciseStore = create((set) => ({
  running: false,
  error: null,
  context: makeExerciseContext(),

  setRunning: (running) => set({ running }),
  setError: (error) => set({ error: error ? String(error) : null }),
  setContext: (context) => set({ context, error: null }),
  resetExercise: () => set({ running: false, error: null, context: makeExerciseContext() }),
}));

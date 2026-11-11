export interface RoutineAction {
  deviceId: string;
  deviceName: string;
  channel: number; // 1-indexed switch channel
  switchName: string;
  targetState: boolean;
}

export interface SmartRoutine {
  id: string;
  name: string;
  description?: string;
  icon: 'sun' | 'moon' | 'sparkles' | 'zap' | 'clock' | 'home' | 'shield';
  type: 'scene' | 'schedule';
  roomId: string; // 'all' or specific room ID
  scheduleTime?: string; // e.g. "07:30 AM" or "22:00"
  repeatDays?: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  actions: RoutineAction[];
  isActive: boolean;
}

const ROUTINES_STORAGE_KEY = 'neuro_smart_routines_v1';

const DEFAULT_ROUTINES: SmartRoutine[] = [
  {
    id: 'default-morning',
    name: 'Good Morning',
    description: 'Turn on morning lighting across all rooms',
    icon: 'sun',
    type: 'scene',
    roomId: 'all',
    actions: [],
    isActive: true,
  },
  {
    id: 'default-all-off',
    name: 'All Switches Off',
    description: 'Instantly switch off all connected devices',
    icon: 'moon',
    type: 'scene',
    roomId: 'all',
    actions: [],
    isActive: true,
  },
  {
    id: 'default-away',
    name: 'Away / Energy Saver',
    description: 'Conserve power across all connected endpoints',
    icon: 'sparkles',
    type: 'scene',
    roomId: 'all',
    actions: [],
    isActive: true,
  },
];

export const routineStorage = {
  getRoutines: (): SmartRoutine[] => {
    if (typeof window === 'undefined') return DEFAULT_ROUTINES;
    try {
      const stored = localStorage.getItem(ROUTINES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_ROUTINES;
  },

  saveRoutines: (routines: SmartRoutine[]): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(routines));
    } catch {
      // ignore
    }
  },

  createRoutine: (routineData: Omit<SmartRoutine, 'id'>): SmartRoutine => {
    const routines = routineStorage.getRoutines();
    const newRoutine: SmartRoutine = {
      ...routineData,
      id: `routine_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    const updated = [newRoutine, ...routines];
    routineStorage.saveRoutines(updated);
    return newRoutine;
  },

  updateRoutine: (id: string, updates: Partial<SmartRoutine>): SmartRoutine | null => {
    const routines = routineStorage.getRoutines();
    const index = routines.findIndex(r => r.id === id);
    if (index === -1) return null;
    const updatedRoutine = { ...routines[index], ...updates };
    routines[index] = updatedRoutine;
    routineStorage.saveRoutines(routines);
    return updatedRoutine;
  },

  deleteRoutine: (id: string): void => {
    const routines = routineStorage.getRoutines();
    const filtered = routines.filter(r => r.id !== id);
    routineStorage.saveRoutines(filtered);
  },
};

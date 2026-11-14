import { api } from './api';
import { formatScheduleTimeToIst } from '../utils/time';

export { formatScheduleTimeToIst };

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
  scheduleTime?: string; // ON Time e.g. "07:30 AM IST" or "07:30"
  scheduleOffTime?: string; // OFF Time e.g. "10:30 PM IST" or "22:30"
  repeatDays?: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  actions: RoutineAction[];
  isActive: boolean;
  created_at?: string;
  updated_at?: string;
}

const ROUTINES_STORAGE_KEY = 'neuro_smart_routines_v2';

/**
 * Empty default routines - strictly NO mock/dummy records when database has no scenes or schedules.
 */
const DEFAULT_ROUTINES: SmartRoutine[] = [];

export const routineStorage = {
  getRoutines: (): SmartRoutine[] => {
    if (typeof window === 'undefined') return DEFAULT_ROUTINES;
    try {
      const stored = localStorage.getItem(ROUTINES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
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

export const routineApi = {
  /**
   * Fetch all routines for home from backend PostgreSQL routines table
   */
  getRoutines: async (homeId?: string): Promise<SmartRoutine[]> => {
    try {
      const url = homeId ? `/routines?homeId=${encodeURIComponent(homeId)}` : '/routines';
      const res = await api.get<{ success: boolean; routines: any[] }>(url);
      if (res.success && Array.isArray(res.routines)) {
        const mapped: SmartRoutine[] = res.routines.map((r: any) => {
          const isSchedule = r.icon === 'clock' || (r.type === 'schedule' && (r.schedule_time || r.schedule_off_time) && r.icon !== 'sun' && r.icon !== 'sparkles' && r.icon !== 'moon');
          const resolvedType: 'scene' | 'schedule' = isSchedule ? 'schedule' : 'scene';
          return {
            id: r.id,
            name: r.name,
            description: r.description || undefined,
            icon: r.icon || (resolvedType === 'schedule' ? 'clock' : 'sun'),
            type: resolvedType,
            roomId: r.room_id || 'all',
            scheduleTime: resolvedType === 'schedule' ? (r.schedule_time || undefined) : undefined,
            scheduleOffTime: resolvedType === 'schedule' ? (r.schedule_off_time || undefined) : undefined,
            repeatDays: Array.isArray(r.repeat_days) ? r.repeat_days : [],
            actions: Array.isArray(r.actions) ? r.actions : [],
            isActive: r.is_active !== undefined ? Boolean(r.is_active) : true,
            created_at: r.created_at,
            updated_at: r.updated_at,
          };
        });
        routineStorage.saveRoutines(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('API routines fetch failed, falling back to local cache:', err);
    }
    return routineStorage.getRoutines();
  },

  /**
   * Save new scene or schedule to backend routines table
   */
  createRoutine: async (routineData: Omit<SmartRoutine, 'id'>, homeId?: string): Promise<SmartRoutine> => {
    try {
      const payload = {
        name: routineData.name,
        description: routineData.description,
        icon: routineData.icon,
        type: routineData.type,
        roomId: routineData.roomId,
        scheduleTime: routineData.scheduleTime,
        scheduleOffTime: routineData.scheduleOffTime,
        repeatDays: routineData.repeatDays,
        actions: routineData.actions,
        isActive: routineData.isActive,
        homeId,
      };
      const res = await api.post<{ success: boolean; routine: any }>('/routines', payload);
      if (res.success && res.routine) {
        const r = res.routine;
        const mapped: SmartRoutine = {
          id: r.id,
          name: r.name,
          description: r.description || undefined,
          icon: r.icon || 'sun',
          type: r.type || 'scene',
          roomId: r.room_id || 'all',
          scheduleTime: r.schedule_time || undefined,
          scheduleOffTime: r.schedule_off_time || undefined,
          repeatDays: Array.isArray(r.repeat_days) ? r.repeat_days : [],
          actions: Array.isArray(r.actions) ? r.actions : [],
          isActive: r.is_active !== undefined ? Boolean(r.is_active) : true,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
        const all = [mapped, ...routineStorage.getRoutines().filter(x => x.id !== mapped.id)];
        routineStorage.saveRoutines(all);
        return mapped;
      }
    } catch (err) {
      console.error('API create routine failed, saving locally:', err);
    }
    return routineStorage.createRoutine(routineData);
  },

  /**
   * Update routine in backend routines table
   */
  updateRoutine: async (id: string, updates: Partial<SmartRoutine>): Promise<SmartRoutine | null> => {
    try {
      const payload: any = { ...updates };
      if (updates.type === 'scene') {
        payload.scheduleTime = null;
        payload.scheduleOffTime = null;
        payload.repeatDays = [];
      } else {
        if (updates.roomId !== undefined) payload.roomId = updates.roomId;
        if (updates.scheduleTime !== undefined) payload.scheduleTime = updates.scheduleTime;
        if (updates.scheduleOffTime !== undefined) payload.scheduleOffTime = updates.scheduleOffTime;
      }
      const res = await api.put<{ success: boolean; routine: any }>(`/routines/${id}`, payload);
      if (res.success && res.routine) {
        const r = res.routine;
        const mapped: SmartRoutine = {
          id: r.id,
          name: r.name,
          description: r.description || undefined,
          icon: r.icon || 'sun',
          type: r.type || 'scene',
          roomId: r.room_id || 'all',
          scheduleTime: r.schedule_time || undefined,
          scheduleOffTime: r.schedule_off_time || undefined,
          repeatDays: Array.isArray(r.repeat_days) ? r.repeat_days : [],
          actions: Array.isArray(r.actions) ? r.actions : [],
          isActive: r.is_active !== undefined ? Boolean(r.is_active) : true,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
        const all = routineStorage.getRoutines().map(x => x.id === id ? mapped : x);
        routineStorage.saveRoutines(all);
        return mapped;
      }
    } catch (err) {
      console.error('API update routine failed, updating locally:', err);
    }
    return routineStorage.updateRoutine(id, updates);
  },

  /**
   * Delete routine from backend routines table
   */
  deleteRoutine: async (id: string): Promise<boolean> => {
    try {
      await api.del(`/routines/${id}`);
    } catch (err) {
      console.error('API delete routine failed:', err);
    }
    routineStorage.deleteRoutine(id);
    return true;
  },

  /**
   * Run routine actions across hardware endpoints
   */
  runRoutine: async (id: string): Promise<boolean> => {
    try {
      const res = await api.post<{ success: boolean }>(`/routines/${id}/run`);
      return Boolean(res.success);
    } catch (err) {
      console.error('API run routine failed:', err);
      return false;
    }
  },
};

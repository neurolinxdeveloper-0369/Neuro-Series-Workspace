import { api } from './api';
export { formatScheduleTimeToIst } from '../utils/time';

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

function mapRoutine(r: any): SmartRoutine {
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
}

export const routineApi = {
  getRoutines: async (homeId?: string): Promise<SmartRoutine[]> => {
    const url = homeId ? `/routines?homeId=${encodeURIComponent(homeId)}` : '/routines';
    const response = await api.get<{ success: boolean; routines: any[] }>(url);
    return response.routines.map(mapRoutine);
  },

  createRoutine: async (routine: Omit<SmartRoutine, 'id'>, homeId?: string): Promise<SmartRoutine> => {
    const response = await api.post<{ success: boolean; routine: any }>('/routines', { ...routine, homeId });
    return mapRoutine(response.routine);
  },

  updateRoutine: async (id: string, updates: Partial<SmartRoutine>): Promise<SmartRoutine> => {
    const payload = updates.type === 'scene'
      ? { ...updates, scheduleTime: null, scheduleOffTime: null, repeatDays: [] }
      : updates;
    const response = await api.put<{ success: boolean; routine: any }>(`/routines/${id}`, payload);
    return mapRoutine(response.routine);
  },

  deleteRoutine: async (id: string): Promise<boolean> => {
    const response = await api.del<{ success: boolean }>(`/routines/${id}`);
    return response.success;
  },

  runRoutine: async (id: string): Promise<boolean> => {
    try {
      const response = await api.post<{ success: boolean }>(`/routines/${id}/run`);
      return response.success;
    } catch {
      return false;
    }
  },
};

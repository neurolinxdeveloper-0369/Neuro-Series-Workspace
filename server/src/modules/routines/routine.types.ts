export interface RoutineActionDTO {
  deviceId: string;
  deviceName: string;
  channel: number;
  switchName: string;
  targetState: boolean;
}

export interface RoutineRecord {
  id: string;
  home_id: string | null;
  user_id: string | null;
  name: string;
  description: string | null;
  icon: string;
  type: 'scene' | 'schedule';
  room_id: string;
  schedule_time: string | null;
  schedule_off_time: string | null;
  repeat_days: string[];
  actions: RoutineActionDTO[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoutineDTO {
  name: string;
  description?: string;
  icon?: string;
  type: 'scene' | 'schedule';
  roomId?: string;
  scheduleTime?: string;
  scheduleOffTime?: string;
  repeatDays?: string[];
  actions?: RoutineActionDTO[];
  isActive?: boolean;
  homeId?: string;
}

export interface UpdateRoutineDTO {
  name?: string;
  description?: string;
  icon?: string;
  type?: 'scene' | 'schedule';
  roomId?: string;
  scheduleTime?: string;
  scheduleOffTime?: string;
  repeatDays?: string[];
  actions?: RoutineActionDTO[];
  isActive?: boolean;
}

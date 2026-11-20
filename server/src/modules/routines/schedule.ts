export function parseScheduleTime(value?: string | null): number | null {
  if (typeof value !== 'string' || !value) return null;
  const match = value.trim().replace(/\s+IST$/i, '').match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  return hour * 60 + minute;
}

export function validateSchedule(data: { type?: string; scheduleTime?: string | null; scheduleOffTime?: string | null; repeatDays?: string[] }): string | null {
  if (data.type && data.type !== 'scene' && data.type !== 'schedule') return 'Choose Scene or Schedule.';
  if (data.type !== 'schedule') return null;
  const on = parseScheduleTime(data.scheduleTime);
  const off = parseScheduleTime(data.scheduleOffTime);
  if ((data.scheduleTime && on === null) || (data.scheduleOffTime && off === null) || (on === null && off === null)) return 'Set a valid schedule time.';
  if (on !== null && on === off) return 'Choose different ON and OFF times.';
  if (data.repeatDays !== undefined && (!Array.isArray(data.repeatDays) || data.repeatDays.some(day => typeof day !== 'string' || !['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(day.toLowerCase().slice(0, 3))))) return 'Choose valid repeat days.';
  return null;
}

interface ScheduledRoutine {
  type: string; is_active: boolean; schedule_time: string | null; schedule_off_time: string | null; repeat_days: string[];
}

export function dueScheduleTargets(routine: ScheduledRoutine, now: Date): boolean[] {
  if (routine.type !== 'schedule' || !routine.is_active) return [];
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  const parts = formatter.formatToParts(now);
  const minute = Number(parts.find(part => part.type === 'hour')?.value) * 60 + Number(parts.find(part => part.type === 'minute')?.value);
  const day = parts.find(part => part.type === 'weekday')?.value.toLowerCase();
  const previousDay = formatter.formatToParts(new Date(now.getTime() - 86400000)).find(part => part.type === 'weekday')?.value.toLowerCase();
  const days = Array.isArray(routine.repeat_days) ? routine.repeat_days.map(value => typeof value === 'string' ? value.toLowerCase().slice(0, 3) : '') : [];
  const allowed = (value?: string) => !days.length || days.includes(value || '');
  const on = parseScheduleTime(routine.schedule_time);
  const off = parseScheduleTime(routine.schedule_off_time);
  // For an overnight interval, OFF belongs to the preceding day's ON event.
  const offDay = on !== null && off !== null && off < on ? previousDay : day;
  if (off === minute && allowed(offDay)) return [false];
  if (on === minute && allowed(day)) return [true];
  return [];
}

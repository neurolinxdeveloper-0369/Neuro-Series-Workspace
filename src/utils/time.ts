/**
 * Indian Standard Time (IST) formatting utilities
 * Timezone: Asia/Kolkata (UTC+05:30)
 * Format: Indian standard date and time (e.g. DD/MM/YYYY, hh:mm:ss a IST)
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current timestamp in Indian Standard Time (ISO compatible string)
 */
export const getNowIstIso = (): string => {
  const now = new Date();
  return now.toISOString();
};

/**
 * Formats a Date or timestamp to Indian Standard Time string with date & time
 * Example output: "14/11/2026, 12:45:30 PM IST"
 */
export const formatIstDateTime = (dateInput?: string | number | Date | null, withSeconds = true): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const formatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(date);

  return `${formatted} IST`;
};

/**
 * Formats a Date or timestamp to Indian Date string
 * Example output: "14 Nov 2026" or "14/11/2026"
 */
export const formatIstDate = (dateInput?: string | number | Date | null, shortMonth = true): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: shortMonth ? 'short' : '2-digit',
    year: 'numeric',
  }).format(date);
};

/**
 * Formats a Date or timestamp to Indian Time string
 * Example output: "12:45 PM IST"
 */
export const formatIstTime = (dateInput?: string | number | Date | null, withSeconds = false): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const formatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(date);

  return `${formatted} IST`;
};

/**
 * Normalizes any HH:mm 24h or 12h time string into Indian Standard Time display
 * e.g. "07:30" -> "07:30 AM IST", "18:45" -> "06:45 PM IST"
 */
export const formatScheduleTimeToIst = (timeStr?: string): string => {
  if (!timeStr) return '';
  if (timeStr.toUpperCase().includes('IST')) return timeStr;
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].slice(0, 2);
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const hh = hours < 10 ? `0${hours}` : `${hours}`;
      return `${hh}:${minutes} ${ampm} IST`;
    }
  }
  return `${timeStr} IST`;
};

/**
 * Converts any time string (12h, 24h, with or without AM/PM/IST) into minutes from midnight (0..1439)
 * Examples:
 * "02:05 AM IST" -> 125
 * "02:05 PM IST" -> 845
 * "14:05" -> 845
 * "02:05" -> 125
 * "2:5 am" -> 125
 */
export const parseTimeToMinutes = (timeStr?: string | null): number | null => {
  if (!timeStr) return null;
  const cleaned = timeStr.replace(/IST/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm) {
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  }
  return (hours % 24) * 60 + minutes;
};

/**
 * Returns current minutes from midnight (0..1439) in Indian Standard Time (Asia/Kolkata)
 */
export const getCurrentIstMinutes = (date: Date = new Date()): number => {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return (hour === 24 ? 0 : hour) * 60 + minute;
};

/**
 * Checks if a stored schedule time matches the given Date (in IST) with minute precision
 */
export const isScheduleTimeMatch = (scheduleTimeStr?: string | null, date: Date = new Date()): boolean => {
  const targetMinutes = parseTimeToMinutes(scheduleTimeStr);
  if (targetMinutes === null) return false;
  const currentMinutes = getCurrentIstMinutes(date);
  return targetMinutes === currentMinutes;
};

/**
 * Checks if today matches the repeat days of a routine (in IST)
 */
export const isScheduleDayMatch = (repeatDays?: string[] | null, date: Date = new Date()): boolean => {
  if (!repeatDays || repeatDays.length === 0) return true;
  const currentDay = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
  }).format(date);
  return repeatDays.some(d => d.toLowerCase().slice(0, 3) === currentDay.toLowerCase().slice(0, 3));
};


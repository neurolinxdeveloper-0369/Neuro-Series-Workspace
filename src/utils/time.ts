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

export function normalizeSwitches(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([channel, state]) =>
    /^(?:[1-9]|1[0-2])$/.test(channel) && typeof state === 'boolean'
  ));
}

export function normalizeReadings(value: unknown) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([channel, entry]) => {
    if (!/^(?:[1-9]|1[0-2])$/.test(channel) || !entry || typeof entry !== 'object') return [];
    const { value: reading, unit } = entry as { value?: unknown; unit?: unknown };
    if (typeof reading !== 'boolean' && !(typeof reading === 'number' && Number.isFinite(reading))) return [];
    return [{ channel: Number(channel), value: reading, unit: typeof unit === 'string' ? unit.trim().slice(0, 16) : '' }];
  });
}

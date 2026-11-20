export const MAX_FIRMWARE_BYTES = 4 * 1024 * 1024;
export const ACTIVE_OTA_STATES = ['queued', 'downloading'];

export function validateFirmware(bytes: Buffer, filename: string, model: string, version: string) {
  if (!/^[\w .()-]{1,100}\.bin$/i.test(filename)) throw new Error('Choose a .bin firmware file (simple filename, up to 104 characters).');
  if (bytes.length < 32 || bytes.length > MAX_FIRMWARE_BYTES || bytes[0] !== 0xe9) throw new Error('Expected an ESP firmware .bin image, 32 bytes to 4 MiB, starting with 0xE9.');
  if (!/^[A-Za-z0-9_-]{1,30}$/.test(model)) throw new Error('Choose a valid target model.');
  if (!/^[A-Za-z0-9._+-]{1,30}$/.test(version)) throw new Error('Enter a firmware version (up to 30 letters, numbers, dots or hyphens).');
}

export function parseOtaStatus(value: unknown): { status: 'downloading' | 'success' | 'failed'; progress: number } | null {
  if (!value || typeof value !== 'object') return null;
  const { status, progress } = value as Record<string, unknown>;
  if (typeof progress !== 'number' || !Number.isInteger(progress)) return null;
  if (status === 'failed' && progress === -1) return { status, progress };
  if (status === 'success' && progress === 100) return { status, progress };
  if (status === 'downloading' && progress >= 0 && progress <= 100) return { status, progress };
  return null;
}

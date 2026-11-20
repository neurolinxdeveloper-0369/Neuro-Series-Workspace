interface ControlDevice {
  id: string;
  device_id: string;
  room_id: string | null;
  model_code: string;
  custom_name: string;
  is_online?: boolean;
  can_control?: boolean;
  endpoints?: { endpoint_type: string; endpoint_index: number }[];
}

export function getOffTargets(devices: ControlDevice[], roomId: string | null) {
  return devices.filter(device => (roomId === null || device.room_id === roomId) && device.can_control !== false)
    .flatMap(device => [...new Set((device.endpoints ?? [])
      .filter(endpoint => endpoint.endpoint_type === 'RELAY')
      .map(endpoint => ['EMS1', 'EMS3'].includes(device.model_code) ? 1 : endpoint.endpoint_index)
      .filter(channel => Number.isInteger(channel) && channel > 0))]
      .map(channel => ({ deviceId: device.device_id, deviceName: device.custom_name, channel, online: device.is_online === true })));
}

import { Router } from 'express';
import { deviceService } from './device.service.js';

export const deviceRouter = Router();

// GET /api/devices - List all devices
deviceRouter.get('/', (_req, res) => {
  const devices = deviceService.getDevices();
  return res.json({ success: true, devices });
});

// POST /api/devices - Add a new device
deviceRouter.post('/', (req, res) => {
  try {
    const { name, room, type, homeId } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Device name is required' });
    }
    const device = deviceService.addDevice({ name, room, type, homeId });
    return res.status(201).json({ success: true, device });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add device';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/devices/:id - Get single device
deviceRouter.get('/:id', (req, res) => {
  const device = deviceService.getDeviceById(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  return res.json({ success: true, device });
});

// PATCH /api/devices/:id/state - Update device state & publish to EMQX
deviceRouter.patch('/:id/state', async (req, res) => {
  try {
    const updated = await deviceService.updateDeviceState(req.params.id, req.body);
    return res.json({ success: true, device: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update device';
    return res.status(400).json({ success: false, error: message });
  }
});

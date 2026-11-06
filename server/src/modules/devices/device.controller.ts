import { Router } from 'express';
import { deviceService } from './device.service.js';

export const deviceRouter = Router();

// GET /api/devices - List all devices
deviceRouter.get('/', (_req, res) => {
  const devices = deviceService.getDevices();
  return res.json({ success: true, devices });
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

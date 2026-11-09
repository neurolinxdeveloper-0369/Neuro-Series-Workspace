import { Router } from 'express';
import { deviceService } from './device.service.js';

export const deviceRouter = Router();

// GET /api/devices - List all devices
deviceRouter.get('/', (_req, res) => {
  const devices = deviceService.getDevices();
  return res.json({ success: true, devices });
});

// POST /api/devices/provision - Provision physical device with parent and child endpoints
deviceRouter.post('/provision', async (req, res) => {
  try {
    const { homeId, roomId, modelCode, mac4, customName, icon, wifiSsid, wifiPassword, firmwareVersion, ipAddress } = req.body;
    if (!homeId || !modelCode || !customName || !wifiSsid) {
      return res.status(400).json({ success: false, error: 'homeId, modelCode, customName and wifiSsid are required' });
    }

    const result = await deviceService.provisionDevice({
      homeId,
      roomId,
      modelCode,
      mac4: mac4 || 'BC88',
      customName,
      icon,
      wifiSsid,
      wifiPassword,
      firmwareVersion: firmwareVersion || 'v1.2.4-neuro',
      ipAddress: ipAddress || '192.168.4.1',
    });

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Provisioning failed';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/devices/home/:homeId - Get all devices with endpoints for a home
deviceRouter.get('/home/:homeId', async (req, res) => {
  try {
    const homeId = Array.isArray(req.params.homeId) ? req.params.homeId[0] : req.params.homeId;
    const devices = await deviceService.getDevicesByHome(homeId);
    return res.json({ success: true, devices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch home devices';
    return res.status(500).json({ success: false, error: message });
  }
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

import { Router } from 'express';
import { DatabaseAdminError, deleteDatabaseRecord, isDatabaseKind, listDatabase, previewDatabaseDeletion } from './database.service.js';

// Mounted after the OTA session middleware; no ordinary account token can reach this router.
export const databaseRouter = Router();
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
databaseRouter.param('kind', (req, res, next, value) => {
  if (!isDatabaseKind(value)) { res.status(404).json({ error: 'Only users, rooms and devices can be managed here.' }); return; }
  next();
});
databaseRouter.param('id', (_req, res, next, value) => {
  if (!uuid.test(value)) { res.status(400).json({ error: 'Invalid record ID.' }); return; }
  next();
});
const session = (authorization?: string) => authorization?.slice(7) || '';
const fail = (res: import('express').Response, error: unknown) => {
  res.status(error instanceof DatabaseAdminError ? error.status : 503).json({ error: error instanceof DatabaseAdminError ? error.message : 'Could not complete database administration. Refresh and retry.' });
};
databaseRouter.get('/:kind', async (req, res) => {
  const { search = '', page = '1', pageSize = '25' } = req.query;
  if (typeof search !== 'string' || search.length > 160 || typeof page !== 'string' || !/^[1-9]\d{0,5}$/.test(page) || typeof pageSize !== 'string' || !/^[1-9]\d?$/.test(pageSize) || Number(pageSize) > 50) {
    res.status(400).json({ error: 'Use a search up to 160 characters, page >= 1 and pageSize 1–50.' }); return;
  }
  try { res.json(await listDatabase(req.params.kind as 'users' | 'rooms' | 'devices', search, Number(page), Number(pageSize))); }
  catch (error) { fail(res, error); }
});
databaseRouter.post('/:kind/:id/preview', async (req, res) => {
  try { res.json({ success: true, preview: await previewDatabaseDeletion(req.params.kind as 'users' | 'rooms' | 'devices', String(req.params.id), session(req.headers.authorization)) }); }
  catch (error) { fail(res, error); }
});
databaseRouter.delete('/:kind/:id', async (req, res) => {
  try { res.json(await deleteDatabaseRecord(req.params.kind as 'users' | 'rooms' | 'devices', String(req.params.id), req.body?.confirmation, req.body?.previewToken, session(req.headers.authorization))); }
  catch (error) { fail(res, error); }
});

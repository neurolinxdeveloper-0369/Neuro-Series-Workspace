import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { PoolClient } from 'pg';
import { db } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { socketManager } from '../websocket/socket.server.js';

export type DatabaseKind = 'users' | 'rooms' | 'devices';
export class DatabaseAdminError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const isDatabaseKind = (value: string): value is DatabaseKind => ['users', 'rooms', 'devices'].includes(value);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const arrays = (rows: Record<string, unknown>[], key = 'id') => rows.map(row => String(row[key]));
const columns = {
  users: ['id', 'full_name', 'email', 'phone_number', 'homes', 'devices', 'created_at'],
  rooms: ['id', 'name', 'home_name', 'owner_email', 'devices', 'created_at'],
  devices: ['id', 'device_id', 'custom_name', 'model_code', 'home_name', 'room_name', 'owner_email', 'is_online', 'firmware_version', 'created_at'],
};
const labels: Record<string, string> = { id: 'Record ID', full_name: 'Name', email: 'Email', phone_number: 'Phone', homes: 'Owned homes', devices: 'Devices', created_at: 'Created', name: 'Room', home_name: 'Home', owner_email: 'Owner email', device_id: 'Hardware ID', custom_name: 'Device', model_code: 'Model', room_name: 'Room', is_online: 'Online', firmware_version: 'Firmware' };

export async function listDatabase(kind: DatabaseKind, search: string, page: number, pageSize: number) {
  const queries = {
    users: `SELECT u.id,u.full_name,u.email,u.phone_number,u.created_at,
      (SELECT count(*)::int FROM homes h WHERE h.owner_id=u.id) AS homes,
      (SELECT count(*)::int FROM devices d JOIN homes h ON h.id=d.home_id WHERE h.owner_id=u.id) AS devices
      FROM users u WHERE concat_ws(' ',u.id::text,u.full_name,u.email,u.phone_number) ILIKE $1`,
    rooms: `SELECT r.id,r.name,r.created_at,h.name AS home_name,u.email AS owner_email,
      (SELECT count(*)::int FROM devices d WHERE d.room_id=r.id) AS devices
      FROM rooms r JOIN homes h ON h.id=r.home_id JOIN users u ON u.id=h.owner_id
      WHERE concat_ws(' ',r.id::text,r.name,h.name,u.full_name,u.email) ILIKE $1`,
    devices: `SELECT d.id,d.device_id,d.custom_name,d.model_code,d.firmware_version,d.created_at,
      (d.is_online AND d.last_seen_at>NOW()-INTERVAL '12 seconds') AS is_online,h.name AS home_name,r.name AS room_name,u.email AS owner_email
      FROM devices d JOIN homes h ON h.id=d.home_id LEFT JOIN rooms r ON r.id=d.room_id JOIN users u ON u.id=h.owner_id
      WHERE concat_ws(' ',d.id::text,d.device_id,d.custom_name,d.model_code,h.name,r.name,u.email) ILIKE $1`,
  };
  const query = queries[kind];
  const result = await db.query(`SELECT count(*)::int AS total FROM (${query}) matched`, ['%' + search + '%']);
  const rows = (await db.query(`${query} ORDER BY created_at DESC,id LIMIT $2 OFFSET $3`, ['%' + search + '%', pageSize, (page - 1) * pageSize])).rows;
  return { success: true, kind, columns: columns[kind].map(key => ({ key, label: labels[key] })), rows, total: result.rows[0].total, page, pageSize };
}

async function deletionScope(client: PoolClient, kind: DatabaseKind, id: string) {
  const targetFields = kind === 'users' ? 'id,full_name,email,phone_number,created_at' : kind === 'rooms' ? 'id,home_id,name,created_at' : 'id,home_id,room_id,device_id,custom_name,model_code,created_at';
  const record = (await client.query(`SELECT ${targetFields} FROM ${kind} WHERE id=$1`, [id])).rows[0];
  if (!record) throw new DatabaseAdminError('Record no longer exists. Refresh the list.', 404);
  const userId = kind === 'users' ? id : null;
  const homes = userId ? (await client.query('SELECT id,name FROM homes WHERE owner_id=$1 ORDER BY id', [userId])).rows : [];
  const homeIds = arrays(homes);
  const rooms = kind === 'rooms' ? [record] : (await client.query('SELECT id,home_id,name FROM rooms WHERE home_id=ANY($1::uuid[]) ORDER BY id', [homeIds])).rows;
  const roomIds = arrays(rooms);
  const devices = kind === 'rooms' ? [] : (await client.query(`SELECT id,device_id,home_id FROM devices WHERE id=$1::uuid OR home_id=ANY($2::uuid[]) ORDER BY id`, [kind === 'devices' ? id : null, homeIds])).rows;
  const deviceIds = arrays(devices);
  const deviceIdentifiers = [...deviceIds, ...arrays(devices, 'device_id')];
  const unassigned = kind === 'rooms' ? (await client.query('SELECT id FROM devices WHERE room_id=$1 ORDER BY id', [id])).rows : [];
  const affectedDeviceIds = [...deviceIds, ...arrays(unassigned)];
  const updates = (await client.query(`SELECT id,status FROM ota_jobs WHERE device_id=ANY($1::uuid[])
    AND (status IN ('queued','downloading') OR (status='unconfirmed' AND download_expires_at>NOW())) ORDER BY id`, [affectedDeviceIds])).rows;
  if (updates.length) throw new DatabaseAdminError('A device in this deletion has an active or unconfirmed firmware update. Confirm the update is finished before deleting.', 409);

  const routines = (await client.query(`SELECT id,home_id,user_id,room_id,actions,is_active FROM routines r WHERE r.home_id=ANY($1::uuid[]) OR r.user_id=$2::uuid
    OR ($3::boolean AND r.home_id=$4::uuid AND r.room_id=ANY($5::text[]))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.actions)='array' THEN r.actions ELSE '[]'::jsonb END) a WHERE a->>'deviceId'=ANY($6::text[])) ORDER BY id`,
  [homeIds, userId, kind === 'rooms', kind === 'rooms' ? record.home_id : null, kind === 'rooms' ? [id, record.name] : [], deviceIdentifiers])).rows;
  const removedRoutines = routines.filter(r => homeIds.includes(r.home_id) || r.user_id === userId && userId !== null);
  const disabledRoutines = routines.filter(r => !removedRoutines.includes(r));
  const members = (await client.query(`SELECT home_id,user_id,room_ids,device_ids FROM home_members WHERE user_id=$1::uuid OR home_id=ANY($2::uuid[])
    OR room_ids && $3::uuid[] OR device_ids && $4::uuid[] ORDER BY home_id,user_id`, [userId, homeIds, roomIds, deviceIds])).rows;
  const invitations = (await client.query(`SELECT id,home_id,invited_by,room_ids,device_ids FROM home_invitations WHERE invited_by=$1::uuid OR home_id=ANY($2::uuid[])
    OR room_ids && $3::uuid[] OR device_ids && $4::uuid[] OR ($5::text IS NOT NULL AND email=$5 AND status='pending') ORDER BY id`, [userId, homeIds, roomIds, deviceIds, userId ? record.email : null])).rows;
  const history = (await client.query(`SELECT id FROM routine_history WHERE user_id=$1::uuid OR home_id=ANY($2::uuid[]) ORDER BY id`, [userId, homeIds])).rows;
  const related = (await client.query(`SELECT
    (SELECT count(*)::int FROM device_endpoints WHERE device_id=ANY($1::text[])) AS endpoints,
    (SELECT count(*)::int FROM device_activity WHERE device_id=ANY($2::uuid[])) AS activity,
    (SELECT count(*)::int FROM energy_usage WHERE device_id=ANY($2::uuid[])) AS energy,
    (SELECT count(*)::int FROM energy_thresholds WHERE device_id=ANY($2::uuid[])) AS thresholds,
    (SELECT count(*)::int FROM ota_jobs WHERE device_id=ANY($2::uuid[])) AS ota_jobs,
    (SELECT count(*)::int FROM device_notifications WHERE home_id=ANY($3::uuid[]) OR device_id=ANY($2::uuid[])) AS notifications,
    (SELECT count(*)::int FROM auth_identities WHERE user_id=$4::uuid) AS identities`, [arrays(devices, 'device_id'), deviceIds, homeIds, userId])).rows[0];
  const label = String(record.full_name || record.name || record.custom_name || record.id);
  const warnings = ['This permanently removes database records. It does not factory-reset or stop physical hardware, revoke shared MQTT credentials, or disconnect it from Wi-Fi/MQTT. Commands already sent to hardware cannot be recalled.'];
  if (kind === 'users') warnings.push('All homes owned by this user are removed, including their rooms, devices, routines and sharing access. Homes owned by other people are kept; this user loses membership in them.', 'The user can create a new, empty account by signing in again. This is account deletion, not a sign-in ban.');
  if (kind === 'rooms') warnings.push('Devices in this room remain registered but become unassigned. Room-scoped routines are disabled and their room assignment is cleared.');
  if (disabledRoutines.length) warnings.push('Surviving routines that refer to deleted records will be disabled for review; deleted-device actions are removed.');
  if (members.some(m => !homeIds.includes(m.home_id) && m.user_id !== userId) || invitations.some(i => !homeIds.includes(i.home_id) && i.invited_by !== userId)) warnings.push('Selected-room/device access lists are updated. Empty restricted lists stay restricted and never become full-home access.');
  const impact = [
    { label: 'Users deleted', count: kind === 'users' ? 1 : 0 },
    { label: 'Owned homes deleted', count: homes.length },
    { label: 'Rooms deleted', count: rooms.length },
    { label: 'Devices deleted', count: devices.length },
    { label: 'Devices kept and unassigned', count: unassigned.length },
    { label: 'Routines deleted', count: removedRoutines.length },
    { label: 'Surviving routines disabled', count: disabledRoutines.length },
    { label: 'Device endpoints deleted', count: related.endpoints },
    { label: 'Device activity entries deleted', count: related.activity },
    { label: 'Daily energy records deleted', count: related.energy },
    { label: 'Energy alert thresholds deleted', count: related.thresholds },
    { label: 'OTA history entries deleted', count: related.ota_jobs },
    { label: 'Device notifications deleted', count: related.notifications },
    { label: 'Sign-in identities deleted', count: related.identities },
    { label: 'Routine history runs deleted', count: history.length },
    { label: 'Memberships removed or restricted lists updated', count: members.length },
    { label: 'Invitations removed or restricted lists updated', count: invitations.length },
  ].filter(item => item.count > 0);
  // Telemetry values are intentionally absent: heartbeat changes do not invalidate a preview.
  const fingerprint = digest({ record, homes, rooms, devices, unassigned, routines, members, invitations, history, related });
  return { kind, id, label, summary: `Permanently delete ${kind === 'users' ? 'user' : kind === 'rooms' ? 'room' : 'device'} “${label}”`, impact, warnings, fingerprint, userId, homeIds, roomIds, deviceIds, deviceIdentifiers, disabledRoutines, revokedUsers: [...new Set(members.map(m => String(m.user_id)))] };
}

export async function previewDatabaseDeletion(kind: DatabaseKind, id: string, sessionToken: string) {
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const scope = await deletionScope(client, kind, id);
    await client.query('COMMIT');
    const token = jwt.sign({ kind, id, fingerprint: scope.fingerprint, session: digest(sessionToken) }, ENV.JWT_SECRET, { algorithm: 'HS256', audience: 'neuro-database-delete-preview', expiresIn: '5m' });
    return { kind, id, label: scope.label, summary: scope.summary, impact: scope.impact, warnings: scope.warnings, confirmation: id, token, expiresAt: new Date(Date.now() + 300000).toISOString() };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function deleteDatabaseRecord(kind: DatabaseKind, id: string, confirmation: unknown, previewToken: unknown, sessionToken: string) {
  if (confirmation !== id || typeof previewToken !== 'string' || previewToken.length > 4096) throw new DatabaseAdminError('Type the complete record ID and review the deletion preview first.');
  let expected: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(previewToken, ENV.JWT_SECRET, { algorithms: ['HS256'], audience: 'neuro-database-delete-preview' });
    if (typeof decoded === 'string' || decoded.kind !== kind || decoded.id !== id || decoded.session !== digest(sessionToken)) throw new Error();
    expected = decoded;
  } catch { throw new DatabaseAdminError('Deletion preview expired or does not match this session. Preview again.', 409); }
  const client = await db.connect();
  let removedUser: string | null = null;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='3s'");
    // Fixed allowlist. Block concurrent insert/update/delete while impact is rechecked.
    await client.query(`LOCK TABLE users,homes,rooms,devices,routines,home_members,home_invitations,routine_history,device_activity,device_endpoints,
      device_notifications,notification_reads,energy_usage,energy_thresholds,ota_jobs,ota_firmware,auth_identities,email_otps,phone_otps,routine_executions IN SHARE ROW EXCLUSIVE MODE`);
    const scope = await deletionScope(client, kind, id);
    if (scope.fingerprint !== expected.fingerprint) throw new DatabaseAdminError('Related records changed since the preview. Preview again before deleting.', 409);
    for (const routine of scope.disabledRoutines) {
      const actions = Array.isArray(routine.actions) ? routine.actions.filter((action: { deviceId?: string }) => !scope.deviceIdentifiers.includes(String(action?.deviceId))) : [];
      const clearRoom = kind === 'rooms' && [id, scope.label].includes(routine.room_id);
      await client.query(`UPDATE routines SET actions=$2::jsonb,is_active=false,room_id=CASE WHEN $3 THEN 'all' ELSE room_id END,updated_at=NOW() WHERE id=$1`, [routine.id, JSON.stringify(actions), clearRoom]);
    }
    // array_remove returns [] for the last item. Never coalesce restricted lists to NULL.
    for (const table of ['home_members', 'home_invitations']) {
      await client.query(`UPDATE ${table} SET room_ids=CASE WHEN room_ids IS NULL THEN NULL ELSE ARRAY(SELECT unnest(room_ids) EXCEPT SELECT unnest($1::uuid[])) END,
        device_ids=CASE WHEN device_ids IS NULL THEN NULL ELSE ARRAY(SELECT unnest(device_ids) EXCEPT SELECT unnest($2::uuid[])) END
        WHERE room_ids && $1::uuid[] OR device_ids && $2::uuid[]`, [scope.roomIds, scope.deviceIds]);
    }
    if (scope.deviceIds.length) await client.query('DELETE FROM device_notifications WHERE device_id=ANY($1::uuid[])', [scope.deviceIds]);
    if (kind === 'users') {
      const identity = (await client.query('SELECT email,phone_number FROM users WHERE id=$1', [id])).rows[0];
      await client.query('DELETE FROM email_otps WHERE email=$1', [identity.email]);
      await client.query('DELETE FROM phone_otps WHERE phone_number=$1', [identity.phone_number]);
      await client.query("DELETE FROM home_invitations WHERE email=$1 AND status='pending'", [identity.email]);
      removedUser = id;
    }
    await client.query(`DELETE FROM ${kind} WHERE id=$1`, [id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (['55P03', '40P01', '40001'].includes((error as { code?: string }).code || '')) throw new DatabaseAdminError('The database is busy or records changed. Preview again and retry.', 409);
    throw error;
  } finally { client.release(); }
  if (removedUser) socketManager.revokeUserSessions(removedUser);
  return { success: true, deleted: { kind, id } };
}

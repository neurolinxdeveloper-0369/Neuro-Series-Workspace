import { db } from '../../config/database.js';

export async function initializeHistory() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS routine_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      home_id UUID REFERENCES homes(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      results JSONB
    );
    CREATE INDEX IF NOT EXISTS routine_history_home ON routine_history(home_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS device_activity (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      run_id UUID REFERENCES routine_history(id) ON DELETE SET NULL,
      channel INTEGER NOT NULL,
      target BOOLEAN NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      failure TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      observed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS activity_by_device ON device_activity(device_id, id DESC);
    CREATE INDEX IF NOT EXISTS activity_by_run ON device_activity(run_id);
    CREATE OR REPLACE FUNCTION record_switch_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.switches IS DISTINCT FROM OLD.switches THEN
        INSERT INTO device_activity (device_id, channel, target, status, observed_at)
        SELECT NEW.id, reported.channel, reported.value = 'true'::jsonb, 'reported', clock_timestamp()
          FROM (
            SELECT key, value, CASE WHEN key ~ '^([1-9]|1[0-2])$' THEN key::int END AS channel
            FROM jsonb_each(NEW.switches)
          ) reported
          WHERE reported.channel IS NOT NULL AND jsonb_typeof(reported.value) = 'boolean'
            AND OLD.switches -> reported.key IS DISTINCT FROM reported.value
            AND NOT EXISTS (SELECT 1 FROM device_activity a WHERE a.device_id = NEW.id
              AND a.channel = reported.channel AND a.target = (reported.value = 'true'::jsonb)
              AND a.status IN ('pending','sent') AND a.observed_at IS NULL
              AND a.created_at > NOW() - INTERVAL '30 seconds');
      END IF;
      RETURN NEW;
    END
    $$;
    CREATE OR REPLACE TRIGGER switch_history_event AFTER UPDATE OF switches ON devices
      FOR EACH ROW EXECUTE FUNCTION record_switch_change();

    CREATE TABLE IF NOT EXISTS energy_usage (
      device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      kwh NUMERIC NOT NULL,
      samples INTEGER NOT NULL,
      PRIMARY KEY(device_id, day)
    );
    CREATE TABLE IF NOT EXISTS energy_thresholds (
      device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
      watts NUMERIC NOT NULL CHECK (watts > 0),
      above BOOLEAN NOT NULL DEFAULT false
    );
    CREATE OR REPLACE FUNCTION record_energy_reading() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE delta NUMERIC;
    BEGIN
      IF NEW.model_code NOT IN ('EM1','EMS1','EM3','EMS3') THEN RETURN NEW; END IF;
      IF NEW.energy_kwh IS NOT NULL AND NEW.energy_kwh IS DISTINCT FROM OLD.energy_kwh THEN
        delta := CASE WHEN OLD.energy_kwh IS NOT NULL AND NEW.energy_kwh >= OLD.energy_kwh THEN NEW.energy_kwh - OLD.energy_kwh ELSE 0 END;
        INSERT INTO energy_usage VALUES (NEW.id, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, delta, 1)
          ON CONFLICT(device_id, day) DO UPDATE SET kwh = energy_usage.kwh + EXCLUDED.kwh, samples = energy_usage.samples + 1;
      END IF;
      IF NEW.power IS NOT NULL AND NEW.power IS DISTINCT FROM OLD.power THEN
        UPDATE energy_thresholds SET above = NEW.power >= watts
          WHERE device_id = NEW.id AND above IS DISTINCT FROM (NEW.power >= watts);
        IF FOUND AND NEW.home_id IS NOT NULL AND EXISTS (SELECT 1 FROM energy_thresholds WHERE device_id = NEW.id AND above) THEN
          INSERT INTO device_notifications (home_id, device_id, device_name, kind, detail)
            VALUES (NEW.home_id, NEW.id, NEW.custom_name, 'alert', 'Power reached the configured limit (' || NEW.power || ' W).');
        END IF;
      END IF;
      RETURN NEW;
    END
    $$;
    CREATE OR REPLACE TRIGGER energy_reading_event AFTER UPDATE OF energy_kwh, power ON devices
      FOR EACH ROW EXECUTE FUNCTION record_energy_reading();
  `);
}

export async function markObserved(deviceIdentifier: string, switches: Record<string, boolean>) {
  await db.query(`
    UPDATE device_activity a SET observed_at = clock_timestamp()
    FROM devices d CROSS JOIN LATERAL jsonb_each($2::jsonb) reported
    WHERE d.device_id = $1 AND a.id = (
      SELECT candidate.id FROM device_activity candidate
      WHERE candidate.device_id = d.id AND candidate.channel::text = reported.key
        AND candidate.created_at > NOW() - INTERVAL '30 seconds' AND candidate.status <> 'reported'
      ORDER BY candidate.id DESC LIMIT 1
    ) AND to_jsonb(a.target) = reported.value AND a.observed_at IS NULL AND a.status <> 'failed'
  `, [deviceIdentifier, JSON.stringify(switches)]);

}

export const activityOutcome = `CASE WHEN a.status IN ('failed','reported') THEN a.status
  WHEN a.observed_at IS NOT NULL THEN 'observed'
  WHEN a.created_at < NOW() - INTERVAL '30 seconds' THEN 'unconfirmed'
  ELSE a.status END AS outcome`;

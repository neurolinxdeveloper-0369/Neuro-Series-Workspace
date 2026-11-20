import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../services/api';
import './OtaScreen.css';

interface OtaDevice { id: string; device_id: string; custom_name: string; model_code: string; firmware_version: string | null; is_online: boolean; owner_email: string | null; owner_name: string | null; home_name: string; room_name: string | null }
interface Firmware { id: string; filename: string; model_code: string; version: string; sha256: string; byte_size: number }
interface OtaJob { id: string; device_id: string; hardware_id: string; custom_name: string; status: string; progress: number; detail: string; filename: string; version: string; created_at: string; updated_at: string; is_online: boolean; last_seen_at: string | null }
const active = (job: OtaJob) => job.status === 'queued' || job.status === 'downloading';
const message = (error: unknown) => error instanceof Error ? error.message.replace(/^API Error \[\d+\]:\s*/, '') : 'The request failed. Try again.';
const OTA_TOKEN = 'neuro_ota_session';
const otaApi = {
  async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem(OTA_TOKEN) || ''}` },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && path !== '/ota/session') { sessionStorage.removeItem(OTA_TOKEN); window.dispatchEvent(new Event('ota-session-expired')); }
      throw new Error(result.error || 'OTA request failed.');
    }
    return result;
  },
};

export default function OtaScreen() {
  const [token, setToken] = useState(sessionStorage.getItem(OTA_TOKEN));
  const [code, setCode] = useState('');
  const [devices, setDevices] = useState<OtaDevice[]>([]);
  const [jobs, setJobs] = useState<OtaJob[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [model, setModel] = useState('');
  const [version, setVersion] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState<File>();
  const [firmware, setFirmware] = useState<Firmware>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [updated, setUpdated] = useState('');
  const uploadController = useRef<AbortController | null>(null);
  const refreshBusy = useRef(false);
  const refresh = useCallback(async () => {
    if (!token || refreshBusy.current) return;
    refreshBusy.current = true;
    try {
      const [deviceData, jobData] = await Promise.all([
        otaApi.request<{ devices: OtaDevice[] }>('/ota/devices'), otaApi.request<{ jobs: OtaJob[] }>('/ota/jobs'),
      ]);
      setDevices(deviceData.devices); setJobs(jobData.jobs); setAllowed(true);
      setUpdated(new Date().toLocaleTimeString()); setError('');
    } catch (failure) { setError(message(failure)); }
    finally { refreshBusy.current = false; }
  }, [token]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 2500);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [refresh]);
  useEffect(() => () => uploadController.current?.abort(), []);
  useEffect(() => {
    const expire = () => { setToken(null); setAllowed(false); setDevices([]); setJobs([]); };
    window.addEventListener('ota-session-expired', expire);
    return () => window.removeEventListener('ota-session-expired', expire);
  }, []);
  useEffect(() => {
    if (!token) return;
    let stopped = false; let socket: WebSocket | undefined; let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const address = new URL(API_BASE_URL, location.href);
      const path = address.pathname.replace(/\/api\/?$/, '/ws');
      socket = new WebSocket(`${address.protocol === 'https:' ? 'wss:' : 'ws:'}//${address.host}${path}`);
      socket.onopen = () => socket?.send(JSON.stringify({ type: 'OTA_AUTH', token }));
      socket.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'CONNECTION_ACK') setLive(true);
          if (data.type === 'OTA_UPDATE') {
            setJobs(previous => previous.map(job => job.id === data.job.id ? { ...job, ...data.job } : job));
            void refresh();
          }
        } catch { /* Ignore unrelated events. */ }
      };
      socket.onclose = () => { setLive(false); if (!stopped) retry = setTimeout(connect, 5000); };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => { stopped = true; clearTimeout(retry); socket?.close(); };
  }, [token, refresh]);
  const chooseFile = (next?: File) => {
    if (busy) return;
    setFirmware(undefined); setConfirmed(false); setNotice('');
    if (next && (!next.name.toLowerCase().endsWith('.bin') || next.size > 4 * 1024 * 1024 || next.size < 32)) {
      setFile(undefined); setError('Choose a .bin firmware file between 32 bytes and 4 MiB.'); return;
    }
    setFile(next); setError('');
  };
  const upload = async () => {
    if (!file || !model || !version.trim() || busy) return;
    setBusy(true); setError(''); setNotice('');
    const controller = new AbortController(); uploadController.current = controller;
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const params = new URLSearchParams({ filename: file.name, model, version: version.trim() });
      const response = await fetch(`${API_BASE_URL}/ota/firmware?${params}`, { method: 'POST', body: file, signal: controller.signal,
        headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${sessionStorage.getItem(OTA_TOKEN) || ''}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Firmware upload failed.');
      setFirmware(result.firmware); setNotice('Firmware uploaded. Select matching online devices and confirm before submitting.');
    } catch (failure) { setError(message(failure)); }
    finally { clearTimeout(timer); uploadController.current = null; setBusy(false); }
  };
  const submit = async () => {
    if (!firmware || !selected.length || !confirmed || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await otaApi.request('/ota/jobs', { firmwareId: firmware.id, deviceIds: selected, confirmed: true });
      setSelected([]); setConfirmed(false); setNotice('Update requests submitted. Watch the device-reported status below.');
      await refresh();
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  };
  const login = async () => {
    setBusy(true); setError('');
    try {
      const result = await otaApi.request<{ token: string }>('/ota/session', { code });
      sessionStorage.setItem(OTA_TOKEN, result.token); setToken(result.token); setCode('');
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  };
  const changing = () => { setFirmware(undefined); setConfirmed(false); setSelected([]); };
  const matching = devices.filter(device => [device.custom_name, device.device_id, device.home_name, device.room_name, device.owner_email, device.owner_name].join(' ').toLowerCase().includes(query.toLowerCase()));
  const available = (device: OtaDevice) => device.is_online && device.model_code === model && !jobs.some(job => job.device_id === device.id && active(job));
  return <div className="ota-page" tabIndex={0} role="region" aria-label="OTA firmware administration"><div className="ota-shell">
    <header className="ota-header"><div><a href="/neuro-series/">Neuro Touch</a><h1>OTA firmware updates</h1><p>Web administration · All users’ registered devices</p></div>
      {token && <button onClick={() => { uploadController.current?.abort(); sessionStorage.removeItem(OTA_TOKEN); setToken(null); setDevices([]); setJobs([]); setAllowed(false); setSelected([]); setFirmware(undefined); }}>Lock OTA page</button>}</header>
    {!token ? <section className="ota-card"><h2>Administrator access</h2><p>Enter the OTA access code. No email address or phone number is needed. Sessions expire after 30 minutes.</p>{error && <p role="alert" className="ota-error">{error}</p>}<form onSubmit={event => { event.preventDefault(); void login(); }}><label>Access code<input type="password" autoComplete="current-password" value={code} minLength={8} maxLength={128} required disabled={busy} onChange={event => setCode(event.target.value)} /></label><button type="submit" className="ota-primary" disabled={busy || code.length < 8}>{busy ? 'Checking…' : 'Unlock OTA'}</button></form></section> : <>
      {error && <p role="alert" className="ota-error">{error}</p>}
      {notice && <p role="status" className="ota-notice">{notice}</p>}
      {!allowed && !error && <p role="status">Checking administrator access…</p>}
      {allowed && <>
        <div className="ota-grid"><section className="ota-card"><h2>1. Upload firmware</h2><p>Choose the exact ESP-12F firmware for the target model. Uploading alone does not update any device.</p>
          <label>Target model<select disabled={busy} value={model} onChange={event => { setModel(event.target.value); changing(); }}><option value="">Choose a model</option>{[...new Set(devices.map(device => device.model_code))].sort().map(code => <option key={code}>{code}</option>)}</select></label>
          <label>Firmware version<input disabled={busy} value={version} maxLength={30} placeholder="e.g. 1.1.0" onChange={event => { setVersion(event.target.value); changing(); }} /></label>
          <label className="ota-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}>Drop a .bin file here or choose a file<input type="file" accept=".bin,application/octet-stream" disabled={busy} onChange={event => chooseFile(event.target.files?.[0])} /><span>{file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KiB` : 'ESP firmware image · maximum 4 MiB'}</span></label>
          <button disabled={busy || !file || !model || !version.trim()} className="ota-primary" onClick={upload}>{busy ? 'Please wait…' : 'Upload firmware'}</button>
          {firmware && <div className="ota-file"><strong>Uploaded: {firmware.filename}</strong><p>{firmware.model_code} · Version {firmware.version}</p><small>SHA-256: {firmware.sha256}</small></div>}
        </section><section className="ota-card"><h2>2. Submit update</h2><p><strong>{selected.length} devices selected</strong> · Up to 20 per submission</p><p>Only online devices matching the uploaded firmware model can be updated. Keep device power and internet connected until flashing and reboot finish.</p>
          <label className="ota-confirm"><input type="checkbox" checked={confirmed} disabled={busy || !firmware} onChange={event => setConfirmed(event.target.checked)} />I verified the firmware model and flash compatibility for all selected devices and understand that they will reboot.</label>
          <button className="ota-primary" disabled={busy || !firmware || !confirmed || !selected.length} onClick={submit}>Submit firmware update</button>
          <p className="ota-muted">MQTT broker acceptance is not device confirmation. Failed firmware may require physical recovery. Updates are never retried automatically.</p>
        </section></div>
        <section className="ota-card"><div className="ota-heading"><h2>Devices ({devices.length})</h2><button disabled={busy} onClick={() => void refresh()}>Refresh list</button></div><label>Search users, homes or devices<input type="search" placeholder="Search name, email, room or device ID" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <div className="ota-table"><table><thead><tr><th>Select</th><th>Device</th><th>Owner / home</th><th>Model / version</th><th>Status</th></tr></thead><tbody>{matching.map(device => <tr key={device.id}><td><input type="checkbox" aria-label={`Select ${device.device_id}`} disabled={busy || !available(device) || (!selected.includes(device.id) && selected.length >= 20)} checked={selected.includes(device.id)} onChange={event => { setConfirmed(false); setSelected(previous => event.target.checked ? [...previous, device.id] : previous.filter(id => id !== device.id)); }} /></td><td><strong>{device.custom_name}</strong><small>{device.device_id}</small></td><td>{device.owner_name || device.owner_email || 'Account'}<small>{device.owner_email} · {device.home_name} / {device.room_name || 'Unassigned'}</small></td><td>{device.model_code}<small>{device.firmware_version || 'Version not reported'}</small></td><td><span className={device.is_online ? 'ota-online' : 'ota-muted'}>{device.is_online ? 'Online' : 'Offline'}</span>{jobs.some(job => job.device_id === device.id && active(job)) && <small>Update in progress</small>}</td></tr>)}</tbody></table></div>
          {!matching.length && <p>No devices match this search.</p>}
        </section>
        <section className="ota-card"><div className="ota-heading"><h2>Update history</h2><span className="ota-muted">{live ? 'Live connection' : 'Reconnecting · polling every 2.5 seconds'}{updated && ` · ${updated}`}</span></div>
          {!jobs.length && <p>No firmware updates have been submitted.</p>}
          <div className="ota-jobs">{jobs.map(job => { const reconnected = job.status === 'success' && job.is_online && job.last_seen_at && new Date(job.last_seen_at).getTime() > new Date(job.updated_at).getTime(); return <article key={job.id} className="ota-job"><div className="ota-heading"><strong>{job.custom_name} · {job.hardware_id}</strong><span className={job.status === 'failed' || job.status === 'unconfirmed' ? 'ota-failed' : 'ota-online'}>{job.status === 'queued' ? 'Waiting for device' : job.status}</span></div><p>{job.filename} → {job.version}</p><progress aria-label={`Firmware progress for ${job.hardware_id}`} max={100} value={Math.max(0, job.progress)} /><p>{job.status === 'failed' ? 'Failed' : `${Math.max(0, job.progress)}%`} · {job.detail}</p>{job.status === 'success' && <p>{reconnected ? 'Device reconnected after flashing.' : 'Awaiting device reconnection after reboot.'}</p>}<small>{new Date(job.created_at).toLocaleString()}</small></article>; })}</div>
        </section>
      </>}
    </>}
  </div></div>;
}

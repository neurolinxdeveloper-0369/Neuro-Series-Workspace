import { useEffect, useRef, useState } from 'react';
import { otaApi, OtaRequestError } from '../services/ota';
import './OtaDatabasePanel.css';

type RecordKind = 'users' | 'rooms' | 'devices';
type DatabaseRow = Record<string, unknown> & { id: string };
interface DatabasePage {
  columns: Array<{ key: string; label: string }>;
  rows: DatabaseRow[];
  total: number;
  page: number;
  pageSize: number;
}
interface DeletionPreview {
  kind: RecordKind;
  id: string;
  label: string;
  summary: string;
  impact: Array<{ label: string; count: number }>;
  warnings: string[];
  confirmation: string;
  token: string;
  expiresAt: string;
}
const kinds: Array<{ id: RecordKind; label: string }> = [
  { id: 'users', label: 'Users' }, { id: 'rooms', label: 'Rooms' }, { id: 'devices', label: 'Devices' },
];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Could not complete the request.';
function display(value: unknown, key: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return key === 'is_online' ? value ? 'Online' : 'Offline' : value ? 'Yes' : 'No';
  if (typeof value === 'string' && /(?:_at|_date)$/.test(key)) {
    const time = new Date(value);
    if (!Number.isNaN(time.getTime())) return time.toLocaleString();
  }
  return Array.isArray(value) ? value.join(', ') : String(value);
}

function DeleteRecordDialog({ preview, onClose, onDeleted }: {
  preview: DeletionPreview; onClose: () => void; onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState(Date.now());
  const expires = new Date(preview.expiresAt).getTime();
  const expired = !Number.isFinite(expires) || expires <= now;
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer); element?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const remove = async () => {
    if (busy || confirmation !== preview.confirmation || stale || expired) return;
    setBusy(true); setError('');
    try {
      await otaApi.request(`/ota/database/${preview.kind}/${encodeURIComponent(preview.id)}`,
        { confirmation, previewToken: preview.token }, { method: 'DELETE' });
      onDeleted();
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof OtaRequestError && [404, 409, 410].includes(failure.status)) setStale(true);
    } finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="ota-db-dialog" aria-labelledby="ota-delete-heading" aria-describedby="ota-delete-summary"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="ota-heading"><h2 id="ota-delete-heading">Review deletion</h2><button type="button" disabled={busy} onClick={onClose}>Cancel</button></header>
    <p className="ota-db-record"><strong>{preview.label}</strong><span>{preview.kind.slice(0, -1)} · {preview.id}</span></p>
    <p id="ota-delete-summary">{preview.summary}</p>
    <h3>What this changes</h3>
    <dl className="ota-db-impact">{preview.impact.map((item, index) => <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.count.toLocaleString()}</dd></div>)}</dl>
    {!!preview.warnings.length && <ul className="ota-db-warnings">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    <p className="ota-db-warnings">This removes database records. It does not factory-reset hardware or erase Wi-Fi credentials stored on a physical device. This action cannot be undone here.</p>
    {error && <p className="ota-error" role="alert">{error}</p>}
    {(expired || stale) ? <p className="ota-error" role="alert">This preview is no longer current. Cancel and review the record again before deleting.</p> : <>
      <label>Type this record ID to confirm<span className="ota-db-confirm-id">{preview.confirmation}</span>
        <input value={confirmation} autoComplete="off" spellCheck={false} disabled={busy} aria-label="Record ID confirmation"
          onChange={event => setConfirmation(event.target.value)} placeholder="Enter the complete record ID" /></label>
      <p className="ota-muted">This preview expires at {new Date(preview.expiresAt).toLocaleTimeString()}.</p>
    </>}
    <footer className="ota-db-dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Keep record</button>
      <button type="button" className="ota-db-delete" disabled={busy || stale || expired || confirmation !== preview.confirmation} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Permanently delete'}</button></footer>
  </dialog>;
}

export function OtaDatabasePanel({ isActive, onDeleted }: { isActive: boolean; onDeleted: () => void }) {
  const [kind, setKind] = useState<RecordKind>('users');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<DatabasePage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<DeletionPreview>();
  const [previewId, setPreviewId] = useState('');
  const previewRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!isActive) { previewRequest.current?.abort(); setPreview(undefined); setPreviewId(''); }
  }, [isActive]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(undefined);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: query, page: String(page), pageSize: String(pageSize) });
      void otaApi.request<DatabasePage>(`/ota/database/${kind}?${params}`, undefined, { signal: controller.signal }).then(result => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
        if (page > lastPage) { setPage(lastPage); return; }
        setData(result);
      }).catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [kind, query, page, pageSize, revision]);
  useEffect(() => () => previewRequest.current?.abort(), []);
  const inspectDelete = async (record: DatabaseRow) => {
    previewRequest.current?.abort();
    const controller = new AbortController(); previewRequest.current = controller;
    setPreviewId(record.id); setError(''); setNotice('');
    try {
      const result = await otaApi.request<{ preview: DeletionPreview }>(`/ota/database/${kind}/${encodeURIComponent(record.id)}/preview`, {}, { signal: controller.signal });
      if (!controller.signal.aborted) setPreview(result.preview);
    } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure)); }
    finally { if (!controller.signal.aborted) setPreviewId(''); }
  };
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <section className="ota-card ota-db-panel" aria-labelledby="ota-database-heading">
    <div className="ota-heading"><div><h2 id="ota-database-heading">Database</h2><p>Browse registered users, rooms and devices. Review a record’s impact before deleting it.</p></div>
      <button type="button" disabled={loading || !!previewId} onClick={() => setRevision(value => value + 1)}>Refresh database</button></div>
    <div className="ota-db-kinds" role="group" aria-label="Database record type">{kinds.map(item => <button key={item.id} type="button" aria-pressed={kind === item.id} disabled={!!previewId}
      onClick={() => { if (item.id !== kind) { setKind(item.id); setPage(1); setQuery(''); setNotice(''); } }}>{item.label}</button>)}</div>
    <div className="ota-db-search"><label>Search {kind}<input type="search" placeholder={`Search ${kind} by name or ID`} maxLength={160} value={query} disabled={!!previewId}
      onChange={event => { setQuery(event.target.value); setPage(1); }} /></label><label>Rows per page<select value={pageSize} disabled={!!previewId} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label></div>
    {error && <p className="ota-error" role="alert">{error}</p>}
    {notice && <p className="ota-notice" role="status">{notice}</p>}
    <div aria-busy={loading}>
      {loading ? <p role="status">Loading {kind}…</p> : data && <>
        <p className="ota-muted" role="status">{total.toLocaleString()} {kind} found{query ? ` for “${query}”` : ''}.</p>
        {data.rows.length ? <div className="ota-table ota-db-table"><table><caption className="sr-only">{kinds.find(item => item.id === kind)?.label} database records</caption>
          <thead><tr>{data.columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}<th scope="col">Actions</th></tr></thead>
          <tbody>{data.rows.map(row => <tr key={row.id}>{data.columns.map(column => <td key={column.key} className={column.key === 'id' ? 'ota-db-id' : undefined}>{display(row[column.key], column.key)}</td>)}
            <td><button type="button" className="ota-db-delete-link" disabled={!!previewId} onClick={() => void inspectDelete(row)} aria-label={`Review deletion of ${String(row.full_name || row.name || row.custom_name || row.id)}`}>{previewId === row.id ? 'Loading preview…' : 'Review deletion'}</button></td></tr>)}</tbody></table></div> : <p>No {kind} match this search.</p>}
        <nav className="ota-db-pagination" aria-label="Database pages"><button type="button" disabled={page <= 1 || !!previewId} onClick={() => setPage(value => value - 1)}>Previous</button>
          <span>Page {page.toLocaleString()} of {pages.toLocaleString()}</span><button type="button" disabled={page >= pages || !!previewId} onClick={() => setPage(value => value + 1)}>Next</button></nav>
      </>}
    </div>
    {preview && <DeleteRecordDialog preview={preview} onClose={() => setPreview(undefined)} onDeleted={() => {
      setNotice(`Deleted ${preview.label}.`); setPreview(undefined); setRevision(value => value + 1); onDeleted();
    }} />}
  </section>;
}

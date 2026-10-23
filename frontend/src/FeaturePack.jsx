import React, { useEffect, useState } from 'react';

// Authenticated staff tasks (list / create / update) backed by /api/tasks.
export function TasksPanel({ request, notify }) {
  const [tasks, setTasks] = useState([]), [query, setQuery] = useState(''), [status, setStatus] = useState(''), [title, setTitle] = useState(''), [priority, setPriority] = useState('NORMAL'), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function load() {
    const params = new URLSearchParams(); if (query) params.set('q', query); if (status) params.set('status', status);
    const data = await request(`/api/tasks?${params}`); setTasks(data.tasks || []);
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);
  async function create(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await request('/api/tasks', { method: 'POST', body: JSON.stringify({ title, priority }) }); setTitle(''); notify('Task created'); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function update(task, next) {
    setError('');
    try { await request(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); notify('Task updated'); await load(); }
    catch (e) { setError(e.message); }
  }
  return <section aria-label="Staff tasks"><header className="pageTitle"><div><span className="eyebrow">Follow-ups</span><h2>Staff tasks</h2><p>Authenticated tasks stored in PostgreSQL. Search and filter the list, create a task, or change its status.</p></div></header>
    {error && <p className="error" role="alert">{error}</p>}
    <form className="panel" onSubmit={create}><div className="formGrid"><label>New task title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label><label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value)}><option>LOW</option><option>NORMAL</option><option>HIGH</option></select></label></div><button className="primary" disabled={busy || !title.trim()}>Create task</button></form>
    <section className="panel"><div className="moduleTitle"><div><h3>Task list</h3><p>{tasks.length} task(s) shown. Zero, false, and empty values are shown as recorded.</p></div></div>
      <div className="buttonRow"><input aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filter task status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>OPEN</option><option>DONE</option><option>CANCELLED</option></select><button type="button" className="secondary" onClick={() => load().catch((e) => setError(e.message))}>Apply filters</button></div>
      {tasks.length ? <div className="tableWrap"><table><thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Due</th><th>Update status</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td>{task.title}</td><td>{task.priority}</td><td>{task.status}</td><td>{task.due_at ? String(task.due_at).slice(0, 10) : ''}</td><td><select aria-label={`Update ${task.title}`} value={task.status} onChange={(e) => update(task, e.target.value)}><option>OPEN</option><option>DONE</option><option>CANCELLED</option></select></td></tr>)}</tbody></table></div> : <p className="muted">No tasks match. Create one above or clear the filters.</p>}
    </section></section>;
}

// Deterministic domain insights over saved records. Labelled offline fallback.
export function InsightsPanel({ request, feature }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError('');
    try { setData(await request(`/api/features/${feature.id}/insights`)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="panel" aria-label="Offline domain insights"><div className="moduleTitle"><div><h3>Domain insights over saved records</h3><p>Three deterministic checks over this register. Works offline; no AI provider is called.</p></div><button type="button" className="secondary" onClick={load} disabled={busy}>{busy ? 'Checking…' : 'Run offline insights'}</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {data && <div><p><span className="badge">aiGenerated: false</span> <span className="badge">{data.source}</span></p><p className="muted">{data.label}</p>
      {data.features.map((item) => <article key={item.id} className="panel"><h4>{item.title}</h4><p>{item.summary}</p>
        <div className="resultMetrics">{item.metrics.map((m) => <article className="metric" key={m.label}><span>{m.label}</span><strong>{String(m.value)}</strong></article>)}</div>
        {item.sections.map((s) => <article key={s.title}><h4>{s.title}</h4><p>{s.detail}</p></article>)}
        <h4>Items ({item.items.length})</h4>{item.items.length ? <ul>{item.items.map((row, i) => <li key={i}>{row.reference} · {row.title}{row.action ? ` — ${row.action}` : ''}</li>)}</ul> : <p className="muted">None reported.</p>}
      </article>)}
    </div>}
  </section>;
}

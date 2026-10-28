import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Chip, CircularProgress, Divider, LinearProgress, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { CloudOutlined, DataUsageRounded, RefreshRounded, StorageRounded, WarningAmberRounded, VerifiedOutlined } from '@mui/icons-material';
import DataGrid from './DashboardDataGrid';
import { vpsStateStyle } from './lib/vpsStyles';

const number = value => Number(value || 0).toLocaleString();
const gib = bytes => bytes == null ? '—' : `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
const when = date => date ? new Date(date).toLocaleString() : 'No output yet';

function Stat({ label, value, caption, icon }) {
  return <Card variant="outlined" sx={{ p: 2.2, minWidth: 0 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography variant="body2" color="text.secondary" sx={{ fontSize: '.78rem' }}>{label}</Typography><Box sx={{ p: .7, display: 'flex', borderRadius: 2, bgcolor: '#303030', color: '#c8c8c8' }}>{icon}</Box></Stack>
    <Typography sx={{ fontWeight: 650, fontSize: '1.75rem', letterSpacing: '-.8px', mt: .4, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary">{caption}</Typography>
  </Card>;
}

export default function VpsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showProcesses, setShowProcesses] = useState(false);
  const refresh = useCallback(async signal => {
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/vps-status', { signal, cache: 'no-store' });
      let payload;
      try { payload = await response.json(); } catch { throw new Error('The VPS status endpoint is unavailable. Restart the dashboard server.'); }
      if (!response.ok) throw new Error(payload.error || 'Could not fetch VPS status.');
      if (!Array.isArray(payload.scrapers)) throw new Error('The VPS returned an invalid status response.');
      setData(payload);
      setSelected(previous => previous ? payload.scrapers.find(row => row.id === previous.id) || null : null);
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  const rows = data?.scrapers || [];
  const totals = rows.reduce((sum, row) => ({ processed: sum.processed + row.processed, total: sum.total + row.total,
    matched: sum.matched + row.counts.matched, blocked: sum.blocked + row.counts.blocked, errors: sum.errors + row.counts.errors }), { processed: 0, total: 0, matched: 0, blocked: 0, errors: 0 });
  const columns = useMemo(() => [
    { field: 'name', headerName: 'Scraper', minWidth: 155, flex: 1, renderCell: ({ row }) => <Stack justifyContent="center" sx={{ height: '100%' }}><Typography sx={{ fontSize: '.8rem', fontWeight: 600 }}>{row.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontSize: '.65rem' }}>{row.session}</Typography></Stack> },
    { field: 'state', headerName: 'Session', width: 112, renderCell: ({ value }) => <Chip size="small" label={value} variant="outlined" sx={{ height: 24, ...vpsStateStyle(value) }} /> },
    { field: 'processed', headerName: 'Progress', width: 190, renderCell: ({ row }) => <Box sx={{ width: '100%', pr: 1 }}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '.75rem', fontVariantNumeric: 'tabular-nums' }}>{number(row.processed)} / {number(row.total)}</Typography><Typography variant="caption" color="text.secondary">{row.total ? (row.processed / row.total * 100).toFixed(1) : '0.0'}%</Typography></Stack><LinearProgress variant="determinate" value={row.total ? Math.min(100, row.processed / row.total * 100) : 0} sx={{ height: 5, mt: .8, borderRadius: 8, bgcolor: '#3b3b3b', '& .MuiLinearProgress-bar': { bgcolor: '#c6c6c6', borderRadius: 8 } }} /></Box> },
    { field: 'matched', headerName: 'ISBN matches', type: 'number', width: 116, valueGetter: (_, row) => row.counts.matched, valueFormatter: value => number(value) },
    { field: 'blocked', headerName: 'Blocked', type: 'number', width: 105, valueGetter: (_, row) => row.counts.blocked, renderCell: ({ value, row }) => <Tooltip title={`${row.processed ? (value / row.processed * 100).toFixed(1) : '0.0'}% of processed records`}><Typography sx={{ fontSize: '.78rem', fontWeight: value ? 700 : 400, color: value ? '#ff9f9f' : 'text.secondary' }}>{number(value)}</Typography></Tooltip> },
    { field: 'errors', headerName: 'Errors', type: 'number', width: 105, valueGetter: (_, row) => row.counts.errors, renderCell: ({ value, row }) => <Tooltip title={`${row.processed ? (value / row.processed * 100).toFixed(1) : '0.0'}% of processed records`}><Typography sx={{ fontSize: '.78rem', fontWeight: value ? 700 : 400, color: value ? '#ffb68b' : 'text.secondary' }}>{number(value)}</Typography></Tooltip> },
    { field: 'not_listed', headerName: 'Not listed', type: 'number', width: 110, valueGetter: (_, row) => row.counts.not_listed, valueFormatter: value => number(value) },
    { field: 'in_stock', headerName: 'In stock', type: 'number', width: 100, valueGetter: (_, row) => row.counts.in_stock, valueFormatter: value => number(value) },
    { field: 'last_updated', headerName: 'Last output', width: 168, renderCell: ({ value }) => <Typography variant="caption" color="text.secondary">{when(value)}</Typography> },
  ], []);
  const processColumns = useMemo(() => [
    { field: 'pid', headerName: 'PID', type: 'number', width: 94, align: 'left', headerAlign: 'left' },
    { field: 'name', headerName: 'Process', flex: 1, minWidth: 155, renderCell: ({ row }) => <Stack justifyContent="center" sx={{ height: '100%' }}><Typography sx={{ fontSize: '.8rem', fontWeight: 600 }}>{row.name}</Typography><Typography variant="caption" color="text.secondary">{row.browser_type || 'main process'}</Typography></Stack> },
    { field: 'scraper', headerName: 'Scraper', minWidth: 130, flex: 1, valueFormatter: value => value || 'Other / system' },
    { field: 'rss_bytes', headerName: 'RAM (RSS)', type: 'number', width: 140, valueFormatter: value => value == null ? '—' : `${(value / 1024 ** 2).toLocaleString(undefined, { maximumFractionDigits: 1 })} MiB` },
    { field: 'memory_percent', headerName: 'RAM %', type: 'number', width: 100, valueFormatter: value => value == null ? '—' : `${value.toFixed(1)}%` },
    { field: 'parent_pid', headerName: 'Parent PID', type: 'number', width: 110 },
  ], []);
  const flagged = rows.filter(row => row.processed >= 10 && row.counts.errors / row.processed >= .5);
  const broken = rows.filter(row => row.invalid_lines > 0);
  return <>
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
      <Box><Typography variant="overline" color="text.secondary">REMOTE MONITOR</Typography><Stack direction="row" spacing={1.2} alignItems="center"><Typography variant="h4">VPS scraper status</Typography><Chip label="VPS 6" variant="outlined" size="small" /></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '.82rem' }}>Live progress and reported outcomes for the 27 October manual-search batch.</Typography></Box>
      <Button variant="contained" onClick={() => refresh()} disabled={loading} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshRounded />} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>{loading ? 'Checking VPS…' : 'Refresh status'}</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}{data && ' The previous snapshot remains visible and may be out of date.'}</Alert>}
    {!data && loading && <Paper variant="outlined" sx={{ p: 5 }}><Stack alignItems="center" spacing={2}><CircularProgress size={28} /><Typography color="text.secondary">Connecting to VPS 6…</Typography></Stack></Paper>}
    {data && <>
      {flagged.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>{flagged.map(row => `${row.name}: ${number(row.counts.errors)} of ${number(row.processed)} processed records are errors`).join(' · ')}. Review the scraper before relying on these results.</Alert>}
      {broken.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>Some output lines could not be parsed: {broken.map(row => `${row.name} (${row.invalid_lines})`).join(', ')}. Progress excludes those lines.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }, gap: 2, mb: 3 }}>
        <Stat label="Active scrapers" value={`${rows.filter(row => row.running === true).length} / ${rows.length}`} caption={data.shared_runtime ? 'Using browser contexts; others queued or stopped' : 'tmux sessions currently present'} icon={<CloudOutlined fontSize="small" />} />
        <Stat label="Inputs processed" value={number(totals.processed)} caption={`of ${number(totals.total)} across scrapers`} icon={<DataUsageRounded fontSize="small" />} />
        <Stat label="ISBN matches" value={number(totals.matched)} caption="Reported by the scrapers" icon={<VerifiedOutlined fontSize="small" />} />
        <Stat label="Blocks / errors" value={`${number(totals.blocked)} / ${number(totals.errors)}`} caption="Recorded output outcomes" icon={<WarningAmberRounded fontSize="small" />} />
      </Box>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ p: 2.5 }}><Box><Typography variant="h6">Scrapers</Typography><Typography variant="caption" color="text.secondary">Select a row for the outcome breakdown and remote output path.</Typography></Box><Typography variant="caption" color="text.secondary">Checked {when(data.checked_at)}</Typography></Stack>
        <Divider />
        <Box sx={{ width: '100%', height: 565 }}><DataGrid rows={rows} columns={columns} loading={loading} disableRowSelectionOnClick onRowClick={({ row }) => setSelected(row)} hideFooter rowHeight={58} columnHeaderHeight={44} sx={{ border: 0, bgcolor: '#222', fontSize: '.78rem', '--DataGrid-rowBorderColor': '#333', '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader, & .MuiDataGrid-filler': { bgcolor: '#222' }, '& .MuiDataGrid-columnHeaderTitle': { fontSize: '.7rem', fontWeight: 600, color: 'text.secondary' }, '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center', outlineOffset: -2 }, '& .MuiDataGrid-row': { cursor: 'pointer' }, '& .MuiDataGrid-row:hover': { bgcolor: '#2d2d2d' } }} /></Box>
        {selected && <><Divider /><Box sx={{ p: 2.5 }}><Stack direction="row" justifyContent="space-between" spacing={2}><Typography variant="h6">{selected.name} · outcome breakdown</Typography><Button size="small" onClick={() => setSelected(null)}>Close</Button></Stack><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>{Object.entries(selected.statuses).map(([status, count]) => <Chip key={status} size="small" variant="outlined" label={`${status}: ${number(count)}`} />)}</Stack><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, overflowWrap: 'anywhere' }}>Remote output: /root/book_listing_automator/{selected.output}</Typography><Typography variant="caption" color="text.secondary">Last ISBN: {selected.last_isbn || '—'} · Exit code: {selected.exit_code ?? '—'}</Typography></Box></>}
      </Paper>
      <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}><StorageRounded fontSize="small" sx={{ color: 'text.secondary' }} /><Typography variant="body2">VPS resources</Typography></Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1.5}>
            <Typography variant="caption" color="text.secondary">Available RAM: {gib(data.memory?.available_bytes)} / {gib(data.memory?.total_bytes)} · Swap used: {gib(data.memory?.swap_used_bytes)} / {gib(data.memory?.swap_total_bytes)}</Typography>
            <Button size="small" variant="outlined" onClick={() => setShowProcesses(value => !value)} aria-expanded={showProcesses} aria-controls="vps-processes">{showProcesses ? 'Hide processes' : 'View processes'}</Button>
          </Stack>
        </Stack>
        {data.shared_runtime && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Shared pool: {data.shared_runtime.browser_instances} browser(s), {data.shared_runtime.active_contexts} active contexts, {data.shared_runtime.queued_contexts} queued jobs.</Typography>}
      </Paper>
      {showProcesses && <Paper id="vps-processes" variant="outlined" sx={{ mt: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2.5 }}><Typography variant="h6">Processes by RAM</Typography><Typography variant="caption" color="text.secondary">Showing {number(data.processes?.length)} of {number(data.process_count)} processes, sorted by resident memory. Refresh status to update.</Typography>
          {!!data.scraper_groups?.length && <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>{data.scraper_groups.map(group => <Chip key={group.scraper} size="small" variant="outlined" label={`${group.scraper}: ${group.process_count} processes · ${gib(group.rss_bytes)} RSS`} />)}</Stack>}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, lineHeight: 1.5 }}>RSS includes shared memory; group totals add process RSS and can count shared pages more than once. Scraper ownership is inferred from the process tree.</Typography>
        </Box>
        <Divider />
        {data.processes ? <Box sx={{ width: '100%', height: 500 }}><DataGrid rows={data.processes} getRowId={row => row.pid} columns={processColumns} initialState={{ pagination: { paginationModel: { pageSize: 10 } }, sorting: { sortModel: [{ field: 'rss_bytes', sort: 'desc' }] } }} pageSizeOptions={[10, 25, 50, 100]} disableRowSelectionOnClick sx={{ border: 0, bgcolor: '#222', fontSize: '.78rem', '--DataGrid-rowBorderColor': '#333', '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader, & .MuiDataGrid-filler, & .MuiDataGrid-footerContainer': { bgcolor: '#222' }, '& .MuiDataGrid-columnHeaderTitle': { fontSize: '.7rem', fontWeight: 600, color: 'text.secondary' }, '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' }, '& .MuiTablePagination-root': { color: 'text.secondary' } }} /></Box>
          : <Alert severity="warning" sx={{ m: 2 }}>{data.process_error || 'Process information is unavailable. Refresh the status or restart the dashboard.'}</Alert>}
      </Paper>}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, lineHeight: 1.6 }}>Counts come from recorded output, so undetected blocks may appear under other statuses. Stock counts cover listings marked found. A running session does not guarantee that it is making progress. Refresh checks the VPS without changing its jobs.</Typography>
    </>}
  </>;
}

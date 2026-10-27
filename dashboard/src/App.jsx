import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Avatar, Box, Breadcrumbs, Button, Card, Chip, CircularProgress,
  Divider, Drawer, FormControl, IconButton, InputAdornment, InputLabel, Link,
  List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Paper, Select,
  Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowForwardRounded, ArrowOutwardRounded, CheckCircleOutlineRounded,
  CloseRounded, CloudUploadOutlined, DataObjectRounded, DescriptionOutlined,
  FilterAltOffRounded, FolderOpenOutlined, GridViewRounded, HelpOutlineRounded,
  LibraryBooksOutlined, MenuRounded, SearchRounded, ShieldOutlined,
  StorefrontOutlined, TableRowsRounded, VerifiedOutlined, WarningAmberRounded, DnsOutlined,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { formatMoney, normalizeRecords } from './lib/output';
import { parseDataFile } from './lib/dataFile';
import ProjectFileDialog from './ProjectFileDialog';
import VpsDashboard from './VpsDashboard';
import { demoRecords } from './demo';
import { listRecentOutputs, saveRecentOutput, readRecentOutput, removeRecentOutput } from './lib/recentOutputs';

const SIDEBAR = 224;
const statuses = ['In stock', 'Out of stock', 'Not found', 'Unknown', 'Blocked', 'Error'];
const statusColors = { 'In stock': 'success', 'Out of stock': 'error', 'Not found': 'default', Unknown: 'warning', Blocked: 'warning', Error: 'error' };
const mono = { fontFamily: '"SFMono-Regular", Consolas, monospace', fontSize: '0.75rem' };

function StatusChip({ value }) {
  const tone = value === 'In stock'
    ? { color: '#77dfa2', borderColor: '#347653', bgcolor: '#19372a' }
    : value === 'Out of stock'
      ? { color: '#ff999f', borderColor: '#8a454e', bgcolor: '#3b2328' }
      : { borderColor: '#484848', bgcolor: '#2a2a2a' };
  return <Chip size="small" label={value} color={statusColors[value] || 'default'} variant="outlined" sx={{ height: 24, '& .MuiChip-label': { px: 1 }, ...tone }} />;
}

function MatchChip({ value }) {
  return <Chip size="small" label={value} icon={value === 'Matched' ? <CheckCircleOutlineRounded /> : value === 'Mismatch' ? <WarningAmberRounded /> : undefined} color={value === 'Matched' ? 'success' : value === 'Mismatch' ? 'warning' : 'default'} variant="outlined" sx={{ border: 0, '& .MuiChip-icon': { fontSize: 14 } }} />;
}

function Metric({ label, value, caption, icon }) {
  return <Card variant="outlined" sx={{ p: 2.4, minWidth: 0, flex: 1 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>{label}</Typography>
      <Box sx={{ color: '#c8c8c8', display: 'flex', p: 0.8, borderRadius: 2, bgcolor: '#303030' }}>{icon}</Box>
    </Stack>
    <Typography sx={{ fontSize: '2rem', fontWeight: 600, letterSpacing: '-1px', mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary">{caption}</Typography>
  </Card>;
}

function FilterSelect({ label, value, onChange, options }) {
  return <FormControl size="small" sx={{ minWidth: 140 }}>
    <InputLabel>{label}</InputLabel>
    <Select label={label} value={value} onChange={event => onChange(event.target.value)}>
      <MenuItem value="all">All {label.toLowerCase()}</MenuItem>
      {options.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
    </Select>
  </FormControl>;
}

function DetailField({ label, children }) {
  return <Box sx={{ minWidth: 0 }}><Typography variant="overline" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere', mt: 0.4 }}>{children ?? '—'}</Typography></Box>;
}

function RecordDrawer({ row, onClose }) {
  const [tab, setTab] = useState(0);
  return <Drawer anchor="right" open={!!row} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, p: 3 } }}>
    {row && <>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="overline" color="primary">Record inspector</Typography><IconButton aria-label="Close record inspector" onClick={onClose}><CloseRounded /></IconButton></Stack>
      <Typography variant="h6" sx={{ mt: 2, fontSize: '1.3rem', lineHeight: 1.5 }}>{row.title}</Typography>
      {!row.table && <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>{row.author || 'Author not provided'}</Typography>}
      {!row.table && <Stack direction="row" spacing={1} sx={{ mt: 2 }}><StatusChip value={row.status} /><MatchChip value={row.match} /></Stack>}
      <Tabs value={row.table ? 1 : tab} onChange={(_, value) => setTab(value)} sx={{ mt: 3, mb: 3 }}><Tab label="Overview" disabled={row.table} /><Tab label="Raw JSON" /></Tabs>
      {tab === 0 && !row.table ? <>
        {row.error && <Alert severity="error" sx={{ mb: 3 }}>{row.error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          <DetailField label="Searched ISBN">{row.isbn}</DetailField><DetailField label="Found ISBN">{row.foundIsbn}</DetailField>
          <DetailField label="Item price">{formatMoney(row.price, row.currency)}</DetailField><DetailField label="Shipping">{row.shipping}</DetailField>
          <DetailField label="Platform">{row.store}</DetailField><DetailField label="Seller">{row.seller}</DetailField>
          <DetailField label="Seller location">{row.sellerAddress}</DetailField><DetailField label="Binding">{row.binding}</DetailField>
          <DetailField label="Publisher">{row.publisher}</DetailField><DetailField label="Scraped at">{row.date ? new Date(row.date).toLocaleString() : null}</DetailField>
        </Box>
        <Alert severity="info" icon={<ShieldOutlined fontSize="small" />} sx={{ mt: 3 }}>Match and availability labels reflect the scraper output. They have not been independently verified.</Alert>
        {row.url && <Button component="a" href={row.url} target="_blank" rel="noopener noreferrer" endIcon={<ArrowOutwardRounded />} variant="outlined" sx={{ mt: 3, alignSelf: 'flex-start' }}>Open source page</Button>}
        {row.offerIndex === null && row.parent.listings?.length > 0 && <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Seller listings <Typography component="span" color="text.secondary">({row.offerCount})</Typography></Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Switch to Seller offers in the main table to compare and filter every listing.</Typography>
          {normalizeRecords([row.parent]).offers.map(offer => <Paper key={offer.id} variant="outlined" sx={{ p: 2, mb: 1 }}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2">{offer.seller || 'Seller not provided'}</Typography><Typography variant="body2" color="primary">{formatMoney(offer.price, offer.currency)}</Typography></Stack><Typography variant="caption" color="text.secondary">{offer.shipping || 'Shipping not provided'} · {offer.match}</Typography></Paper>)}
        </Box>}
      </> : <Box component="pre" sx={{ ...mono, m: 0, p: 2, bgcolor: 'background.default', borderRadius: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.8 }}>{JSON.stringify(row.raw, null, 2)}</Box>}
    </>}
  </Drawer>;
}

export default function App() {
  const inputRef = useRef(null);
  const loadId = useRef(0);
  const [workspaceView, setWorkspaceView] = useState('outputs');
  const [records, setRecords] = useState([]);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState([]);
  const [storageWarning, setStorageWarning] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState('books');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [store, setStore] = useState('all');
  const [match, setMatch] = useState('all');
  const [selected, setSelected] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [projectBrowserOpen, setProjectBrowserOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  useEffect(() => {
    let active = true;
    listRecentOutputs().then(items => { if (active) setRecents(items); }).catch(() => {
      if (active) setStorageWarning('Recent outputs could not be loaded from browser storage. You can still open files.');
    });
    return () => { active = false; };
  }, []);
  const isTable = file?.kind === 'table';
  const data = useMemo(() => isTable ? { books: [], offers: [] } : normalizeRecords(records), [records, isTable]);
  const stores = useMemo(() => [...new Set([...data.books, ...data.offers].map(row => row.store))].sort(), [data]);
  const rows = useMemo(() => isTable ? records.map((raw, index) => ({ id: `table-${index}`, table: true, title: `Row ${index + 1}`, raw, parent: raw })).filter(row => Object.values(row.raw).some(value => String(value).toLowerCase().includes(query.trim().toLowerCase()))) : data[view].filter(row => {
    const needle = query.trim().toLowerCase();
    return (status === 'all' || row.status === status) && (store === 'all' || row.store === store) && (match === 'all' || row.match === match) && (!needle || [row.title, row.isbn, row.foundIsbn, row.author, row.seller, row.store].some(value => value?.toLowerCase().includes(needle)));
  }), [data, view, status, store, match, query, isTable, records]);
  const matched = data.books.filter(row => row.match === 'Matched').length;
  const errors = data.books.filter(row => ['Error', 'Blocked'].includes(row.status)).length;
  const resetFilters = () => { setQuery(''); setStatus('all'); setStore('all'); setMatch('all'); setPagination(previous => ({ ...previous, page: 0 })); };
  const installRecords = (next, metadata) => { setWorkspaceView('outputs'); setRecords(next); setFile(metadata); setError(null); setSelected(null); resetFilters(); };
  const updateFilter = setter => value => { setter(value); setPagination(previous => ({ ...previous, page: 0 })); };

  async function loadContent(content, metadata, id) {
    const { records: next, kind } = parseDataFile(content, metadata.name);
    if (id !== loadId.current) return;
    installRecords(next, { ...metadata, kind, demo: false });
    try {
      const saved = await saveRecentOutput({ ...metadata, kind }, content, next.length);
      setRecents(await listRecentOutputs());
      if (id === loadId.current) setFile({ ...saved, demo: false });
    } catch { setStorageWarning('This output is open, but could not be saved to recents. Browser storage may be full or unavailable.'); }
  }

  async function openProjectFile(item) {
    const id = ++loadId.current;
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/project-file?path=${encodeURIComponent(item.path)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await loadContent(result.content, { name: result.name, size: result.size, projectPath: result.projectPath }, id);
    } finally { if (id === loadId.current) setLoading(false); }
  }

  async function importFile(picked) {
    if (!picked) return;
    const id = ++loadId.current;
    setLoading(true); setError(null);
    try {
      if (picked.size > 50 * 1024 * 1024) throw new Error('Choose a file smaller than 50 MB. Split larger scraper outputs into smaller files.');
      const content = await picked.text();
      await loadContent(content, { name: picked.name, size: picked.size }, id);
    } catch (err) { if (id === loadId.current) setError(err.message); }
    finally { if (id === loadId.current) setLoading(false); }
  }

  async function openRecent(id) {
    const requestId = ++loadId.current;
    setLoading(true); setError(null); setMobileNav(false);
    try {
      const saved = await readRecentOutput(id);
      if (!saved) throw new Error('This saved output is no longer available. Open the original file again.');
      const { records: next, kind } = parseDataFile(saved.content, saved.metadata.name);
      if (requestId === loadId.current) installRecords(next, { ...saved.metadata, kind, demo: false });
      setRecents(await listRecentOutputs());
    } catch (err) { if (requestId === loadId.current) setError(err.message); }
    finally { if (requestId === loadId.current) setLoading(false); }
  }

  async function forgetRecent(id) {
    try {
      await removeRecentOutput(id);
      setRecents(await listRecentOutputs());
    } catch { setStorageWarning('Could not remove this output from browser storage. Try again.'); }
  }

  const columns = useMemo(() => [
    { field: 'isbn', headerName: 'Searched ISBN', width: 160, renderCell: ({ value }) => <Typography component="span" sx={mono}>{value || '—'}</Typography> },
    { field: 'title', headerName: 'Book / title', flex: 1, minWidth: 290, renderCell: ({ row }) => <Box sx={{ py: 1.25, overflow: 'hidden', width: '100%', lineHeight: 1.4 }}><Tooltip title={row.title}><Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 550 }}>{row.title}</Typography></Tooltip><Typography noWrap variant="caption" color="text.secondary">{row.author || 'Author not provided'}</Typography></Box> },
    { field: 'price', headerName: 'Item price', type: 'number', width: 155, align: 'left', headerAlign: 'left', valueFormatter: (value, row) => formatMoney(value, row.currency), renderCell: ({ row }) => <Typography component="span" sx={{ ...mono, color: row.price === null ? 'text.secondary' : 'text.primary' }}>{formatMoney(row.price, row.currency)}</Typography> },
    { field: 'currency', headerName: 'Currency', width: 90 },
    { field: 'status', headerName: 'Availability', width: 138, renderCell: ({ value }) => <StatusChip value={value} /> },
    { field: 'match', headerName: 'ISBN check', width: 132, renderCell: ({ value }) => <MatchChip value={value} /> },
    { field: 'store', headerName: 'Platform', width: 140 },
    { field: 'seller', headerName: 'Seller', width: 180 },
    { field: 'offerCount', headerName: 'Listings', type: 'number', width: 85 },
    { field: 'shipping', headerName: 'Shipping', width: 170 },
    { field: 'foundIsbn', headerName: 'Found ISBN', width: 155 },
    { field: 'sellerAddress', headerName: 'Seller location', width: 170 },
    { field: 'binding', headerName: 'Binding', width: 125 },
    { field: 'publisher', headerName: 'Publisher', width: 180 },
    { field: 'date', headerName: 'Scraped at', width: 200 },
    { field: 'inspect', headerName: '', width: 48, sortable: false, filterable: false, disableExport: true, disableColumnMenu: true, renderCell: ({ row }) => <Tooltip title="Inspect record"><IconButton size="small" aria-label={`Inspect ${row.isbn || row.title}`} onClick={() => setSelected(row)}><ArrowForwardRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip> },
  ], []);
  const tableColumns = useMemo(() => isTable ? Object.keys(records[0] || {}).map((key, index) => ({ field: `field-${index}`, headerName: key, minWidth: 160, flex: 1, valueGetter: (_, row) => row.raw[key] ?? '' })) : [], [isTable, records]);

  const sidebar = <Stack sx={{ height: '100%', p: 2, overflowY: 'auto' }}>
    <Stack direction="row" spacing={1.2} alignItems="center" sx={{ px: 1, py: 2.3, mb: 3 }}><Avatar variant="rounded" sx={{ bgcolor: '#363636', color: '#ededed', width: 34, height: 34 }}><LibraryBooksOutlined fontSize="small" /></Avatar><Box><Typography sx={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.3px' }}>Book Listing</Typography><Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', letterSpacing: 1.5 }}>SCRAPER WORKSPACE</Typography></Box></Stack>
    <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, mb: 1 }}>Workspace</Typography>
    <List disablePadding><ListItemButton selected={workspaceView === 'outputs'} onClick={() => { setWorkspaceView('outputs'); setMobileNav(false); }} sx={{ borderRadius: 2, '&.Mui-selected': { bgcolor: '#323232', color: 'primary.main' } }}><ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}><GridViewRounded sx={{ fontSize: 19 }} /></ListItemIcon><ListItemText primary="Output explorer" primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600 }} /></ListItemButton><ListItemButton selected={workspaceView === 'vps'} onClick={() => { setWorkspaceView('vps'); setMobileNav(false); }} sx={{ borderRadius: 2, mt: .5, '&.Mui-selected': { bgcolor: '#323232', color: 'primary.main' } }}><ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}><DnsOutlined sx={{ fontSize: 19 }} /></ListItemIcon><ListItemText primary="VPS" primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600 }} /></ListItemButton></List>
    <Button startIcon={<FolderOpenOutlined />} onClick={() => { setMobileNav(false); setProjectBrowserOpen(true); }} sx={{ mt: 1, justifyContent: 'flex-start', color: 'text.secondary', px: 1.5, fontSize: '0.8rem' }}>Browse project files</Button>
    <Box sx={{ mt: 3, mb: 2, flex: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>Recent outputs</Typography>
      {recents.length ? <List disablePadding aria-label="Recent outputs" sx={{ mt: 1 }}>
        {recents.map(recent => <Stack direction="row" key={recent.id} alignItems="center" sx={{ mb: 0.5, borderRadius: 2, bgcolor: file?.id === recent.id ? '#323232' : 'transparent' }}>
          <Tooltip title={`${recent.projectPath || recent.name} · ${new Date(recent.openedAt).toLocaleString()}`}>
            <ListItemButton disabled={loading} selected={file?.id === recent.id} onClick={() => openRecent(recent.id)} aria-label={`Open recent output ${recent.name}`} sx={{ minWidth: 0, borderRadius: 2, px: 1.2, py: 1 }}>
              <ListItemIcon sx={{ minWidth: 28 }}><DescriptionOutlined sx={{ fontSize: 17 }} /></ListItemIcon>
              <ListItemText primary={recent.name} secondary={`${recent.count.toLocaleString()} records`} primaryTypographyProps={{ noWrap: true, fontSize: '0.73rem', fontWeight: 550 }} secondaryTypographyProps={{ fontSize: '0.65rem' }} />
            </ListItemButton>
          </Tooltip>
          <Tooltip title="Remove from recents"><IconButton size="small" disabled={loading} aria-label={`Remove recent output ${recent.name}`} onClick={() => forgetRecent(recent.id)} sx={{ mr: 0.4, color: 'text.secondary' }}><CloseRounded sx={{ fontSize: 14 }} /></IconButton></Tooltip>
        </Stack>)}
      </List> : <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, mt: 1, lineHeight: 1.7 }}>Files you open will appear here.</Typography>}
    </Box>
    <Divider /><Button onClick={() => { setHelpOpen(true); setMobileNav(false); }} startIcon={<HelpOutlineRounded />} sx={{ mt: 1.5, justifyContent: 'flex-start', color: 'text.secondary', fontSize: '0.76rem' }}>Format guide</Button>
  </Stack>;

  return <Box sx={{ display: 'flex', minHeight: '100vh' }}>
    <Box component="nav" aria-label="Workspace navigation" sx={{ width: SIDEBAR, flexShrink: 0, display: { xs: 'none', md: 'block' }, borderRight: 1, borderColor: 'divider', bgcolor: '#1c1c1c', position: 'fixed', inset: '0 auto 0 0' }}>{sidebar}</Box>
    <Drawer open={mobileNav} onClose={() => setMobileNav(false)} PaperProps={{ sx: { width: SIDEBAR, bgcolor: '#1c1c1c' } }}>{sidebar}</Drawer>
    <Box sx={{ width: { xs: '100%', md: `calc(100% - ${SIDEBAR}px)` }, ml: { md: `${SIDEBAR}px` }, minWidth: 0 }}>
      <Box component="header" sx={{ height: 66, px: { xs: 2, lg: 4.5 }, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center"><IconButton aria-label="Open navigation" onClick={() => setMobileNav(true)} sx={{ display: { md: 'none' } }}><MenuRounded /></IconButton><Breadcrumbs sx={{ fontSize: '0.75rem' }}><Typography color="text.secondary" sx={{ fontSize: 'inherit' }}>Workspace</Typography><Typography sx={{ fontSize: 'inherit' }}>{workspaceView === 'vps' ? 'VPS' : 'Output explorer'}</Typography></Breadcrumbs></Stack>
        <Chip icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'secondary.main', ml: '10px !important' }} />} label="Local workspace" size="small" variant="outlined" sx={{ fontSize: '0.67rem' }} />
      </Box>
      <Box component="main" sx={{ p: { xs: 2, sm: 3, lg: 4.5 }, maxWidth: 1920, mx: 'auto' }}>
        <Box component="input" ref={inputRef} type="file" accept=".json,.jsonl,.ndjson,.csv,.tsv,.txt,application/json,text/csv,text/plain" aria-label="Choose scraper output file" sx={{ display: 'none' }} onChange={event => { importFile(event.target.files?.[0]); event.target.value = ''; }} />
        {workspaceView === 'vps' ? <VpsDashboard /> : <>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3.5 }}>
          <Box><Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}><Typography variant="overline" color="primary">DATA WORKSPACE</Typography><Chip label="v0.1" size="small" sx={{ height: 18, fontSize: '0.6rem', color: 'text.secondary' }} /></Stack><Typography variant="h4">A clearer view of every result.</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.82rem' }}>Explore book listings, compare sellers, and check what your scraper found.</Typography></Box>
          <Button variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FolderOpenOutlined />} onClick={() => setProjectBrowserOpen(true)} disabled={loading} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' }, px: 2.3, py: 1 }}>Open output file</Button>
        </Stack>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}{file && ' Your previous file is still open.'}</Alert>}
        {storageWarning && <Alert severity="warning" onClose={() => setStorageWarning(null)} sx={{ mb: 2 }}>{storageWarning}</Alert>}
        {file?.demo && <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => setProjectBrowserOpen(true)}>Open real output</Button>}>Sample data · These synthetic examples demonstrate the interface and are not live scraper results.</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2, mb: 3 }}>
          <Metric label={isTable ? 'Data rows' : 'Book records'} value={file ? (isTable ? records.length : data.books.length).toLocaleString() : '—'} caption={isTable ? 'Rows in this data file' : 'One record per input item'} icon={<LibraryBooksOutlined fontSize="small" />} />
          <Metric label="Seller offers" value={file && !isTable ? data.offers.length.toLocaleString() : '—'} caption="Including unavailable listings" icon={<StorefrontOutlined fontSize="small" />} />
          <Metric label="Reported ISBN matches" value={file && !isTable ? matched.toLocaleString() : '—'} caption={file && !isTable ? `${data.books.length ? Math.round(matched / data.books.length * 100) : 0}% of book records` : 'As reported by the scraper'} icon={<VerifiedOutlined fontSize="small" />} />
          <Metric label="Errors & blocks" value={file && !isTable ? errors.toLocaleString() : '—'} caption="Records that need attention" icon={<WarningAmberRounded fontSize="small" />} />
        </Box>
        <Paper id="results" variant="outlined" onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length !== 1) setError('Drop one output file at a time.'); else importFile(event.dataTransfer.files[0]); }} sx={{ overflow: 'hidden', borderColor: dragging ? 'primary.main' : 'divider', outline: dragging ? '2px solid #a0a0a0' : 'none', transition: 'border-color .2s' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }} sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
            <Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6">Scraper results</Typography><Chip size="small" label={file ? (isTable ? records.length : data[view].length).toLocaleString() : 'No file'} sx={{ height: 20, color: 'text.secondary', fontSize: '0.65rem' }} /></Stack><Typography variant="caption" color="text.secondary">{file ? 'Click a row to inspect the full record and its source.' : 'Your output, organized and ready to inspect.'}</Typography></Box>
            {!isTable && <Tabs value={view} onChange={(_, value) => { setView(value); setPagination(previous => ({ ...previous, page: 0 })); }} sx={{ minHeight: 38, '& .MuiTab-root': { minHeight: 38, py: 0.5, fontSize: '0.76rem', minWidth: 95 } }}><Tab icon={<LibraryBooksOutlined sx={{ fontSize: 16 }} />} iconPosition="start" value="books" label="Books" /><Tab icon={<TableRowsRounded sx={{ fontSize: 16 }} />} iconPosition="start" value="offers" label="Seller offers" /></Tabs>}
          </Stack>
          <Divider />
          {file && <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2, flexWrap: 'wrap', rowGap: 1.5 }}>
            <TextField size="small" placeholder="Search title, ISBN, or seller…" value={query} onChange={event => updateFilter(setQuery)(event.target.value)} inputProps={{ 'aria-label': 'Search results' }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18 }} /></InputAdornment> }} sx={{ flex: 1, minWidth: 220 }} />
            {!isTable && <><FilterSelect label="Availability" value={status} onChange={updateFilter(setStatus)} options={statuses} />
            <FilterSelect label="Platforms" value={store} onChange={updateFilter(setStore)} options={stores} />
            <FilterSelect label="ISBN checks" value={match} onChange={updateFilter(setMatch)} options={['Matched', 'Mismatch', 'Unverified']} /></>}
            <Tooltip title="Reset filters"><IconButton aria-label="Reset filters" onClick={resetFilters}><FilterAltOffRounded fontSize="small" /></IconButton></Tooltip>
          </Stack>}
          {!file ? <Stack alignItems="center" textAlign="center" sx={{ px: 3, py: { xs: 6, md: 8 }, bgcolor: '#222222' }}>
            <Box sx={{ position: 'relative', mb: 3 }}><Paper variant="outlined" sx={{ width: 74, height: 84, transform: 'rotate(-9deg)', bgcolor: '#222222', position: 'absolute', left: -9, top: 0 }} /><Paper variant="outlined" sx={{ width: 74, height: 84, position: 'relative', display: 'grid', placeItems: 'center', bgcolor: '#222222' }}><DataObjectRounded sx={{ fontSize: 32, color: 'primary.main' }} /></Paper></Box>
            <Typography variant="h6" sx={{ fontSize: '1.15rem', mb: 1 }}>Good data deserves a better view.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 390, lineHeight: 1.8 }}>Drop a scraper output here, or choose a file to explore books, seller prices, and ISBN matches in one place.</Typography>
            <Button variant="outlined" startIcon={<CloudUploadOutlined />} onClick={() => setProjectBrowserOpen(true)} disabled={loading} sx={{ mt: 3, px: 3 }}>Choose output file</Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>JSON · JSONL · CSV · TSV · TXT · Up to 50 MB</Typography>
            <Button size="small" endIcon={<ArrowForwardRounded sx={{ fontSize: 14 }} />} onClick={() => { loadId.current++; setLoading(false); installRecords(demoRecords, { name: 'sample-abebooks.jsonl', demo: true }); }} sx={{ mt: 3, color: 'text.secondary', fontSize: '0.75rem' }}>Explore sample data</Button>
          </Stack> : <Box sx={{ height: 560, width: '100%' }}>
            <DataGrid key={`${file.name}-${view}-${file.kind || 'books'}`} rows={rows} columns={isTable ? tableColumns : columns} loading={loading} showToolbar disableRowSelectionOnClick onRowClick={({ row }) => setSelected(row)} paginationModel={pagination} onPaginationModelChange={setPagination} pageSizeOptions={[25, 50, 100]} rowHeight={64} columnHeaderHeight={44} initialState={{ columns: { columnVisibilityModel: { currency: false, shipping: view === 'offers', sellerAddress: false, foundIsbn: false, binding: false, publisher: false, date: false, offerCount: view === 'books', seller: view === 'offers' } } }} slotProps={{ toolbar: { csvOptions: { fileName: file.name.replace(/\.[^.]+$/, '') + '-' + view }, printOptions: { disableToolbarButton: true } } }} sx={{ border: 0, fontSize: '0.78rem', '--DataGrid-containerBackground': '#282828', '--DataGrid-rowBorderColor': '#323232', '--DataGrid-t-header-background-base': '#282828', '--DataGrid-t-toolbar-background-base': '#282828', bgcolor: '#222222', color: '#ededed', '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader, & .MuiDataGrid-sortButton, & .MuiDataGrid-filler, & .MuiDataGrid-footerContainer': { bgcolor: '#222222' }, '&& .MuiDataGrid-sortButton': { backgroundColor: '#282828' }, '& .MuiDataGrid-columnSeparator': { color: '#484848' }, '& .MuiDataGrid-columnHeaderTitle': { fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }, '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center', lineHeight: 'normal', outlineOffset: -2 }, '& .MuiDataGrid-row': { cursor: 'pointer' }, '& .MuiDataGrid-row:hover': { bgcolor: '#2d2d2d' }, '& .MuiDataGrid-toolbar': { px: 2, bgcolor: '#222222' }, '& .MuiTablePagination-root': { color: 'text.secondary' } }} />
          </Box>}
          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ px: 2.5, py: 1.5 }}><Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}><DescriptionOutlined sx={{ fontSize: 15, color: 'text.secondary' }} /><Typography variant="caption" color="text.secondary" noWrap>{file ? file.projectPath || file.name : 'No output file selected'}{file?.size != null ? ` · ${(file.size / 1024).toLocaleString('en-US', { maximumFractionDigits: 1 })} KB` : ''}</Typography></Stack><Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{file ? `${rows.length.toLocaleString()} ${isTable ? 'rows' : view === 'books' ? 'books' : 'offers'} in view` : 'Read-only explorer'}</Typography></Stack>
        </Paper>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mt: 2.5 }}><Typography variant="caption" color="text.secondary">Prices stay in their source currency. Shipping is displayed separately.</Typography><Link component="button" variant="caption" onClick={() => setHelpOpen(true)} underline="hover" color="text.secondary">About output formats <ArrowOutwardRounded sx={{ fontSize: 11, verticalAlign: 'middle' }} /></Link></Stack>
        </>}
      </Box>
    </Box>
    <ProjectFileDialog open={projectBrowserOpen} onClose={() => setProjectBrowserOpen(false)} onOpen={openProjectFile} onUpload={() => inputRef.current?.click()} loading={loading} />
    <RecordDrawer key={selected?.id || 'empty'} row={selected} onClose={() => setSelected(null)} />
    <Drawer anchor="right" open={helpOpen} onClose={() => setHelpOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, p: 3 } }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">Output format guide</Typography><IconButton aria-label="Close format guide" onClick={() => setHelpOpen(false)}><CloseRounded /></IconButton></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 3, lineHeight: 1.9 }}>Choose a file from the project’s output folder. The explorer accepts a JSON array, a single result object, or JSON Lines (.json, .jsonl, .ndjson). The project’s .json files often contain one object per line.</Typography><Divider sx={{ my: 3 }} /><Typography variant="h6">Two ways to inspect</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.9 }}>Books shows one row per input record. Seller offers expands each nested listings array into individual rows. Records without nested listings appear as a single offer when a price or seller is provided.</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 2, lineHeight: 1.9 }}>Use the grid toolbar for column visibility, column filters, and CSV export. Select any row to inspect metadata and the original JSON. Search and filters apply to the active view; summary cards describe the whole file.</Typography><Alert severity="warning" sx={{ mt: 3 }}>AbeBooks verification is pending. This dashboard displays existing data and does not start scrapers, validate live stock, or convert currencies.</Alert></Drawer>
  </Box>;
}

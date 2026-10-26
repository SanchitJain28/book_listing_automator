import { useEffect, useState } from 'react';
import { Alert, Box, Breadcrumbs, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Link, List, ListItemButton, ListItemIcon, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { ArrowUpwardRounded, CloseRounded, DescriptionOutlined, FolderOutlined, RefreshRounded, SearchRounded } from '@mui/icons-material';

export default function ProjectFileDialog({ open, onClose, onOpen, onUpload, loading }) {
  const [folder, setFolder] = useState('');
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setFetching(true); setError(null); setItems([]); setQuery('');
    fetch(`/api/project-files?path=${encodeURIComponent(folder)}`, { signal: controller.signal }).then(async response => {
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Project browsing requires the local Vite server. Restart npm run dashboard and try again.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!controller.signal.aborted) setItems(result.items);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [open, folder, revision]);
  const parts = folder.split('/').filter(Boolean);
  const visible = items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
  async function choose(item) {
    setError(null);
    try { await onOpen(item); onClose(); }
    catch (err) { setError(err.message); }
  }
  return <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md" aria-labelledby="project-file-title">
    <DialogTitle id="project-file-title"><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography component="span" variant="h6">Open project output</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Browse data files in this project.</Typography></Box><IconButton aria-label="Close project file browser" disabled={loading} onClick={onClose}><CloseRounded /></IconButton></Stack></DialogTitle>
    <DialogContent dividers sx={{ p: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.5 }}><IconButton size="small" aria-label="Parent folder" disabled={!folder || loading || fetching} onClick={() => setFolder(parts.slice(0, -1).join('/'))}><ArrowUpwardRounded fontSize="small" /></IconButton><Breadcrumbs sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}><Link component="button" color="inherit" onClick={() => setFolder('')} disabled={loading}>Project</Link>{parts.map((part, index) => <Link component="button" key={index} color="inherit" onClick={() => setFolder(parts.slice(0, index + 1).join('/'))} disabled={loading}>{part}</Link>)}</Breadcrumbs><IconButton aria-label="Refresh folder" disabled={loading || fetching} onClick={() => setRevision(value => value + 1)}><RefreshRounded fontSize="small" /></IconButton></Stack>
      <Box sx={{ px: 2, pb: 1.5 }}><TextField fullWidth size="small" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter files in this folder…" inputProps={{ 'aria-label': 'Filter project files' }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} /></Box>
      {error && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
      <Box sx={{ height: 350, overflowY: 'auto', borderTop: 1, borderColor: 'divider' }}>
        {fetching ? <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}><CircularProgress size={24} /><Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>Reading project folders…</Typography></Stack> : <List disablePadding aria-label="Project files">{visible.map(item => <ListItemButton key={item.path} disabled={loading} onClick={() => item.type === 'folder' ? setFolder(item.path) : choose(item)} aria-label={`${item.type === 'folder' ? 'Open folder' : 'Open file'} ${item.name}`} sx={{ px: 3, py: 1.1 }}><ListItemIcon sx={{ minWidth: 38 }}>{item.type === 'folder' ? <FolderOutlined /> : <DescriptionOutlined />}</ListItemIcon><ListItemText primary={item.name} secondary={item.type === 'folder' ? 'Folder' : `${(item.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB · ${new Date(item.modifiedAt).toLocaleDateString()}`} primaryTypographyProps={{ fontSize: '0.85rem', noWrap: true }} secondaryTypographyProps={{ fontSize: '0.7rem' }} />{item.type === 'file' && <Chip size="small" label={item.name.split('.').pop().toUpperCase()} sx={{ ml: 1 }} />}</ListItemButton>)}{!visible.length && !error && <Typography variant="body2" color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>{query ? 'No files match this filter.' : 'No supported data files in this folder.'}</Typography>}</List>}
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}><Typography variant="caption" color="text.secondary">JSON · JSONL · CSV · TSV · TXT</Typography><Stack direction="row" spacing={1}><Button disabled={loading} onClick={() => { onClose(); onUpload(); }}>From computer…</Button><Button disabled={loading} onClick={onClose}>Cancel</Button></Stack></DialogActions>
  </Dialog>;
}

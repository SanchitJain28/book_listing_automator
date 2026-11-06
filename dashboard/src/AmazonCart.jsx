import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { CheckCircleOutlineRounded, ExpandMoreRounded, LoginRounded, PauseRounded,
  PlayArrowRounded, ShoppingCartOutlined, StopRounded, TravelExploreRounded } from '@mui/icons-material';
import { useAmazonCart } from './lib/useAmazonCart';

const amber = '#f2bb67';
const mono = { fontFamily: '"SFMono-Regular", Consolas, monospace' };
const money = value => typeof value === 'number' ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value) : '—';
const running = session => session && !['completed', 'stopped', 'failed'].includes(session.status);
const stateNames = { starting: 'Starting', running: 'Running', waiting: 'Your turn', pausing: 'Pausing', paused: 'Paused', stopping: 'Stopping', stopped: 'Stopped', completed: 'Completed', failed: 'Failed' };
const tone = value => value ? { color: '#85d6ad', borderColor: '#355a46', bgcolor: '#20362b' } : { color: '#f1b5a3', borderColor: '#67483e', bgcolor: '#352923' };

function Stat({ label, value, caption }) {
  return <Paper variant="outlined" sx={{ p: 2.2, minWidth: 0 }}><Typography variant="overline" color="text.secondary">{label}</Typography>
    <Typography sx={{ mt: 0.7, fontSize: '1.75rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary">{caption}</Typography></Paper>;
}

function Offers({ evaluation }) {
  const offers = evaluation?.evaluatedOffers || [];
  if (!offers.length) return <Box sx={{ p: 3 }}><Typography variant="body2" color="text.secondary">{evaluation ? evaluation.reason || evaluation.error || 'No eligible offers found.' : 'Offers will appear after a book is evaluated.'}</Typography></Box>;
  return <TableContainer><Table size="small" aria-label="Amazon offer comparison" sx={{ minWidth: 780, '& .MuiTableCell-root': { py: 1.7, fontSize: '0.76rem' } }}>
    <TableHead><TableRow>{['Seller / edition', 'Book', 'Shipping', 'Delivery', 'Effective', 'Score', 'Decision'].map(label => <TableCell key={label} sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{label}</TableCell>)}</TableRow></TableHead>
    <TableBody>{offers.map((offer, index) => {
      const best = evaluation.chosenOffer;
      const selected = best && offer.candidateAsin === best.candidateAsin && offer.source === best.source && offer.offerIndex === best.offerIndex && offer.popoverEntryIndex === best.popoverEntryIndex;
      return <TableRow key={index} sx={{ bgcolor: selected ? '#f2bb670b' : undefined }}>
        <TableCell><Stack direction="row" spacing={1} alignItems="center">{selected && <CheckCircleOutlineRounded sx={{ color: amber, fontSize: 16 }} />}<Box><Typography variant="body2" sx={{ fontSize: '0.78rem' }}>{offer.seller}</Typography><Typography variant="caption" color="text.secondary">{offer.candidateFormat || offer.popoverLabel || 'Physical book'} · {offer.conditionDetail || offer.condition}</Typography></Box></Stack></TableCell>
        <TableCell sx={mono}>{money(offer.itemPrice)}</TableCell><TableCell>{offer.shippingFee ? money(offer.shippingFee) : 'Free'}</TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>{offer.deliveryDateFormatted || offer.deliveryText}<Typography display="block" variant="caption" color="text.secondary">{offer.deliveryDays == null ? 'Date not parsed' : `${offer.deliveryDays} days`}{offer.deliveryPenalty > 0 ? ` · ${money(offer.deliveryPenalty)} penalty` : ''}</Typography></TableCell>
        <TableCell sx={{ ...mono, fontWeight: selected ? 700 : 400, color: selected ? amber : undefined }}>{money(offer.effectivePrice)}</TableCell>
        <TableCell sx={mono}>{offer.score?.toFixed(2) || '—'}</TableCell><TableCell><Chip size="small" variant="outlined" label={selected ? 'Selected' : offer.isQualified ? 'Qualified' : offer.failureReason || 'Rejected'} sx={selected ? { color: amber, borderColor: '#705632' } : tone(offer.isQualified)} /></TableCell>
      </TableRow>;
    })}</TableBody></Table></TableContainer>;
}

function TitleChecks({ evaluation }) {
  const checks = useMemo(() => {
    const seen = new Set();
    return (evaluation?.identityChecks || []).filter(offer => {
      const key = JSON.stringify([offer.candidateAsin, offer.candidateTitle, offer.titleCheck, offer.identityError]);
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }, [evaluation]);
  if (!checks.length) return null;
  return <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h6">Edition & title verification</Typography><Typography variant="caption" color="text.secondary">Each candidate is checked against the PO ISBN. Changed ISBNs on yellow rows use Gemini.</Typography>
    <Stack spacing={2} sx={{ mt: 2 }}>{checks.map((offer, i) => <Box key={i} sx={{ borderLeft: '2px solid', borderColor: offer.identityVerified ? '#6aab86' : '#b88757', pl: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Typography variant="body2" sx={mono}>{offer.candidateAsin || 'Unknown ASIN'}</Typography><Chip size="small" variant="outlined" sx={tone(offer.identityVerified)} label={offer.identityMethod === 'ISBN' ? 'ISBN matched' : offer.identityVerified ? 'Title matched' : 'Needs review'} /></Stack>
      <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.7 }}>{offer.candidateTitle || 'Candidate title unavailable'}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, lineHeight: 1.7 }}>{offer.titleCheck?.reason || offer.titleCheck?.error || offer.identityReason || offer.identityError || 'Gemini skipped: this edition matches the PO ISBN.'}</Typography>
      {offer.titleCheck && <Typography component="pre" variant="caption" sx={{ ...mono, m: 0, mt: 1, p: 1.2, bgcolor: '#181818', borderRadius: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'text.secondary' }}>{JSON.stringify(offer.titleCheck, null, 2)}</Typography>}
    </Box>)}</Stack></Paper>;
}

function Prompt({ prompt, reply, disabled }) {
  const [value, setValue] = useState('');
  useEffect(() => { setValue(''); }, [prompt?.id]);
  if (!prompt) return null;
  const action = (text, response, primary = false) => <Button key={text} disabled={disabled} variant={primary ? 'contained' : 'outlined'} onClick={() => reply(response)} sx={primary ? { bgcolor: amber, color: '#241b0c', '&:hover': { bgcolor: '#ffd18c' } } : {}}>{text}</Button>;
  return <Paper variant="outlined" aria-label="Session controls" sx={{ p: 2.5, borderColor: '#806037', bgcolor: '#2a241c' }}>
    <Typography variant="overline" sx={{ color: amber }}>YOUR TURN</Typography>
    <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>{({ command: 'Ready to start?', feedback: 'Add a note for this book', add: 'Add the selected offer?', next: 'What would you like to do next?', batch: 'Batch complete', continue: 'Continue your session' })[prompt.kind]}</Typography>
    {prompt.kind === 'command' && <><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Start from the selected cursor, or jump to a sheet row or PO ISBN.</Typography><Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>{action('Start processing', 'START', true)}{action('Sign in', 'LOGIN')}</Stack><Stack component="form" direction="row" spacing={1} sx={{ mt: 2 }} onSubmit={e => { e.preventDefault(); if (value.trim()) reply(`GOTO ${value.trim()}`); }}><TextField size="small" label="Row or PO ISBN" value={value} onChange={e => setValue(e.target.value.replace(/[^0-9Xx]/g, ''))} fullWidth /><Button type="submit" disabled={disabled || !value.trim()} variant="outlined">Go</Button></Stack><Box sx={{ mt: 1 }}>{action('Reset to beginning', 'RESET')}</Box></>}
    {prompt.kind === 'feedback' && <Stack component="form" spacing={2} onSubmit={e => { e.preventDefault(); reply(value); }}><TextField label="Feedback (optional)" size="small" value={value} onChange={e => setValue(e.target.value.replace(/[\r\n]/g, ' '))} inputProps={{ maxLength: 4000 }} fullWidth /><Button type="submit" variant="contained" disabled={disabled}>Continue to cart decision</Button></Stack>}
    {prompt.kind === 'add' && <><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Review the chosen seller, edition, and delivery before adding.</Typography><Stack direction="row" spacing={1}>{action('Add to cart', 'YES', prompt.defaultValue === 'YES')}{action('Skip book', 'NO', prompt.defaultValue !== 'YES')}</Stack></>}
    {prompt.kind === 'next' && <Stack direction="row" flexWrap="wrap" gap={1}>{action('Next book', '', true)}{action('Retry book', 'RETRY')}{action('Back to menu', 'MENU')}</Stack>}
    {prompt.kind === 'batch' && <><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Complete checkout in the Amazon browser and empty the cart before continuing.</Typography>{action('Cart is empty · next batch', '', true)}</>}
    {prompt.kind === 'continue' && <><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Complete sign-in in the separate Amazon browser window, then continue here.</Typography>{action('I have signed in · continue', '', true)}</>}
  </Paper>;
}

export default function AmazonCart() {
  const workspace = useAmazonCart();
  const { session, tabs, connected, connectionMode, busy, loading, error } = workspace;
  const [config, setConfig] = useState('');
  const [profile, setProfile] = useState('2');
  const [mode, setMode] = useState('manual');
  const [cursor, setCursor] = useState('');
  const [stopOpen, setStopOpen] = useState(false);
  const [autoStartOpen, setAutoStartOpen] = useState(false);
  const [follow, setFollow] = useState(true);
  const logEnd = useRef(null);
  const live = running(session);
  const selected = tabs.find(tab => tab.file === config);
  useEffect(() => {
    if (!config && tabs.length) setConfig(tabs.find(tab => tab.name === 'ZB346+ZB346B_2NOV_UNDER3_POD_NOPUB')?.file || tabs[0].file);
  }, [tabs, config]);
  useEffect(() => { if (follow && logEnd.current) logEnd.current.scrollIntoView({ block: 'nearest' }); }, [session?.logs?.at(-1)?.id, follow]);
  const start = (nextMode = mode) => workspace.action({ op: 'start', config, profile, mode: nextMode, cursor });
  const book = session?.book;
  const evaluation = session?.evaluation;
  const best = evaluation?.chosenOffer;
  const disabled = busy || !connected;
  const processed = session?.processed || 0;
  const total = session?.configuration?.total;
  const progress = total ? Math.min(100, ((book?.index || session.configuration.startIndex || 0) / total) * 100) : 0;
  return <Stack spacing={3}>
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={2}>
      <Box><Stack direction="row" gap={1} alignItems="center"><ShoppingCartOutlined sx={{ color: amber, fontSize: 19 }} /><Typography variant="overline" sx={{ color: amber }}>AMAZON WORKSPACE</Typography></Stack><Typography variant="h4" sx={{ mt: 1 }}>Every offer. A clearer decision.</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Manage your Amazon cart sessions, compare editions, and review each book here.</Typography></Box>
      <Chip size="small" variant="outlined" label={connected ? connectionMode === 'polling' ? 'Live updates · every 2s' : 'Live connection' : 'Connecting…'} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, color: connected ? '#85d6ad' : 'text.secondary', borderColor: connected ? '#355a46' : 'divider' }} />
    </Stack>
    {error && <Alert severity="error" onClose={() => workspace.setError('')}>{error}</Alert>}
    {session?.error && <Alert severity="error">{session.error}</Alert>}
    {!connected && live && <Alert severity="info">Reconnecting to your session. The process keeps its current state; controls will return when connected.</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
      <Stat label="This session" value={processed} caption="Books processed" /><Stat label="Cart additions" value={session?.added || 0} caption="Confirmed by Amazon" />
      <Stat label="Current batch" value={`${session?.batchAdded || 0} / ${session?.configuration?.batchLimit || 50}`} caption={book ? `Batch ${book.batchNumber}` : 'Cart batch capacity'} /><Stat label="For review" value={session?.review || 0} caption="Books needing your attention" />
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }, gap: 3, alignItems: 'start' }}>
      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ px: 2.5, py: 2 }}><Typography variant="h6">Current book</Typography><Chip size="small" variant="outlined" label={stateNames[session?.status] || 'No session'} sx={session?.status === 'waiting' ? { color: amber, borderColor: '#705632' } : {}} /></Stack><Divider />
          {book ? <Box sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center"><Typography variant="caption" color="text.secondary">ROW {book.sheetRowNumber} · BOOK {book.index} OF {book.total}</Typography><Chip size="small" label={book.rowColor === 'yellow' ? 'Different edition' : book.rowColor === 'red' ? 'Accepted loss' : 'Exact ISBN'} sx={{ height: 22, fontSize: '0.65rem', bgcolor: book.rowColor === 'yellow' ? '#473a22' : '#303030', color: book.rowColor === 'yellow' ? '#f2cc7f' : 'text.secondary' }} /></Stack>
            <Typography sx={{ mt: 1.5, mb: 2, fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.5 }}>{book.title}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
              {[['PO ISBN · searched', book.isbn], ['Amazon ISBN · reference', book.amazonIsbn || '—'], ['Compare price', money(book.targetPrice)], ['Sell price', money(book.sellPrice)]].map(([label, value]) => <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ ...mono, mt: .6, overflowWrap: 'anywhere' }}>{value}</Typography></Box>)}
            </Box>
            {evaluation && <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, bgcolor: best ? '#29271f' : '#292929', border: '1px solid', borderColor: best ? '#5f5032' : 'divider' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Typography variant="overline" sx={{ color: best ? amber : 'text.secondary' }}>{evaluation.cartAddedSuccess ? 'ADDED TO CART' : evaluation.userConfirmedAddToCart === false ? 'SKIPPED' : best ? 'SELECTED OFFER' : evaluation.reason || evaluation.status}</Typography><Typography variant="body2" sx={{ mt: .8 }}>{best ? `${best.seller} · ${best.conditionDetail || best.condition}` : evaluation.error || 'No offer selected for purchase.'}</Typography></Box>{best && <Box><Typography sx={{ fontSize: '1.6rem', color: amber, fontWeight: 600 }}>{money(best.totalPrice)}</Typography><Typography variant="caption" color="text.secondary">{best.deliveryDateFormatted || best.deliveryText}</Typography></Box>}</Stack>
            </Box>}
            {evaluation?.userConfirmedAddToCart && evaluation.cartAddedSuccess === false && <Alert severity="warning" sx={{ mt: 2 }}>Cart addition was not confirmed. {evaluation.reason || 'Check live activity for details.'}</Alert>}
          </Box> : <Stack alignItems="center" textAlign="center" sx={{ px: 3, py: 7 }}><TravelExploreRounded sx={{ fontSize: 40, color: '#737373', mb: 2 }} /><Typography variant="h6">Ready when you are.</Typography><Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mt: 1, lineHeight: 1.8 }}>{live ? session.phase : 'Choose a sheet tab and browser profile, then open a session. Book details and verified offers will appear here.'}</Typography></Stack>}
          {live && <LinearProgress variant={book ? 'determinate' : 'indeterminate'} value={progress} sx={{ height: 3, bgcolor: '#35302a', '& .MuiLinearProgress-bar': { bgcolor: amber } }} />}
        </Paper>
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Box sx={{ p: 2.5 }}><Typography variant="h6">Offer comparison</Typography><Typography variant="caption" color="text.secondary">Book price + shipping + delivery penalty. The selected offer is highlighted.</Typography></Box><Divider /><Offers evaluation={evaluation} /></Paper>
        <TitleChecks evaluation={evaluation} />
        {!!session?.records?.length && <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h6">Recent decisions</Typography><Stack divider={<Divider />} sx={{ mt: 1 }}>{session.records.slice(0, 10).map((record, i) => <Stack key={`${record.timestamp}-${i}`} direction="row" gap={2} justifyContent="space-between" sx={{ py: 1.5 }}><Box sx={{ minWidth: 0 }}><Typography variant="body2" noWrap>{record.expectedTitle || record.isbn}</Typography><Typography variant="caption" color="text.secondary">Row {record.sheetRowNumber} · {record.isbn}</Typography></Box><Typography variant="caption" sx={{ color: record.cartAddedSuccess ? '#85d6ad' : 'text.secondary', flexShrink: 0, maxWidth: '40%', textAlign: 'right' }}>{record.cartAddedSuccess ? 'Added to cart' : record.userConfirmedAddToCart === false && record.status === 'QUALIFIED' ? 'Skipped by you' : record.reason || 'Skipped'}</Typography></Stack>)}</Stack></Paper>}
      </Stack>
      <Stack spacing={2.5} sx={{ position: { lg: 'sticky' }, top: 24, gridRow: { xs: 1, lg: 'auto' }, minWidth: 0 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h6">{live ? 'Session overview' : 'Open a session'}</Typography>
          {live ? <Stack spacing={1.5} sx={{ mt: 2 }}><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{session.tabName}</Typography><Typography variant="caption" color="text.secondary">Profile {session.profile} · {session.mode === 'auto' ? 'Auto mode' : session.mode === 'login' ? 'Sign-in mode' : 'Manual review'}</Typography><Typography variant="body2" sx={{ color: amber }}>{session.phase}</Typography>{session.account && <Typography variant="caption" color="text.secondary">{session.account.signedIn ? session.account.greeting : 'Sign-in needed in the Amazon browser'}</Typography>}
            {session.configuration && <Typography variant="caption" color="text.secondary">Starting row {session.configuration.startRow || '—'} · {session.configuration.pacingSeconds}s auto pacing</Typography>}
            <Stack direction="row" gap={1}>{session.mode !== 'login' && <Button disabled={disabled || !!session.prompt || session.status === 'stopping'} startIcon={session.status === 'paused' || session.status === 'pausing' ? <PlayArrowRounded /> : <PauseRounded />} onClick={() => workspace.control(['paused', 'pausing'].includes(session.status) ? 'resume' : 'pause')}>{['paused', 'pausing'].includes(session.status) ? 'Resume' : 'Pause'}</Button>}<Button disabled={disabled || session.status === 'stopping'} startIcon={<StopRounded />} onClick={() => setStopOpen(true)}>Stop session</Button></Stack>
          </Stack> : <Stack spacing={2} sx={{ mt: 2.5 }}>
            <FormControl fullWidth size="small"><InputLabel id="amazon-tab-label">Sheet tab</InputLabel><Select labelId="amazon-tab-label" label="Sheet tab" value={config} onChange={e => setConfig(e.target.value)} disabled={loading || busy} sx={{ '& .MuiSelect-select': { fontSize: '0.75rem' } }}>{tabs.map(tab => <MenuItem key={tab.file} value={tab.file} sx={{ fontSize: '0.8rem', whiteSpace: 'normal' }}>{tab.name}</MenuItem>)}</Select></FormControl>
            <Stack direction="row" spacing={1.5}><FormControl fullWidth size="small"><InputLabel id="amazon-profile-label">Profile</InputLabel><Select labelId="amazon-profile-label" label="Profile" value={profile} onChange={e => setProfile(e.target.value)}><MenuItem value="1">Profile 1</MenuItem><MenuItem value="2">Profile 2</MenuItem></Select></FormControl><TextField label="Cursor" size="small" value={cursor} placeholder={selected?.cursor == null ? 'Latest' : String(selected.cursor)} onChange={e => setCursor(e.target.value.replace(/\D/g, '').slice(0, 6))} helperText="Blank uses saved cursor" /></Stack>
            <FormControl fullWidth size="small"><InputLabel id="amazon-mode-label">Mode</InputLabel><Select labelId="amazon-mode-label" label="Mode" value={mode} onChange={e => setMode(e.target.value)}><MenuItem value="manual">Manual review</MenuItem><MenuItem value="auto">Auto mode</MenuItem></Select></FormControl>
            <Typography variant="caption" color="text.secondary">{selected ? `${selected.total.toLocaleString()} books · saved cursor ${selected.cursor ?? 'none'}${selected.startRow ? ` · row ${selected.startRow}` : ''}` : loading ? 'Reading sheet configurations…' : 'No sheet configurations available.'}</Typography>
            <Button variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <PlayArrowRounded />} disabled={disabled || !config || loading} onClick={() => mode === 'auto' ? setAutoStartOpen(true) : start()} sx={{ bgcolor: amber, color: '#241b0c', '&:hover': { bgcolor: '#ffd18c' } }}>Open session</Button>
            <Button variant="outlined" startIcon={<LoginRounded />} disabled={disabled} onClick={() => start('login')}>Sign in to this profile</Button>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>Runs on this computer with your saved Amazon profile. Close any terminal session using the same profile before starting.</Typography>
          </Stack>}
        </Paper>
        <Prompt prompt={session?.prompt} reply={workspace.reply} disabled={disabled || session?.status === 'stopping'} />
        {session?.status === 'paused' && <Alert severity="info">Paused before the next action. Resume when ready.</Alert>}
      </Stack>
    </Box>
    <Accordion defaultExpanded={false} disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}><AccordionSummary expandIcon={<ExpandMoreRounded />}><Stack direction="row" spacing={1.5} alignItems="center"><Typography variant="h6">Live activity</Typography><Chip size="small" label={`${session?.logs?.length || 0} lines`} sx={{ height: 22, color: 'text.secondary' }} /></Stack></AccordionSummary><AccordionDetails><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} sx={{ mb: 1 }}><Typography variant="caption" color="text.secondary">Latest 300 lines · reconnecting does not replay actions</Typography><Button size="small" onClick={() => setFollow(v => !v)}>{follow ? 'Pause scrolling' : 'Follow latest'}</Button></Stack><Box role="log" aria-label="Amazon session activity" sx={{ maxHeight: 340, minHeight: 100, overflow: 'auto', p: 2, bgcolor: '#151515', borderRadius: 2 }}>
      {(session?.logs || []).map(line => <Typography key={line.id} component="div" sx={{ ...mono, fontSize: '0.7rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.9, color: line.level === 'warning' ? '#e4bca1' : '#b8b8b8' }}>{line.message}</Typography>)}{!session?.logs?.length && <Typography variant="caption" color="text.secondary">Session activity will appear here.</Typography>}<div ref={logEnd} /></Box></AccordionDetails></Accordion>
    <Dialog open={stopOpen} onClose={() => setStopOpen(false)}><DialogTitle>Stop this Amazon session?</DialogTitle><DialogContent><Typography variant="body2">The automation browser will close. Books already in the cart remain there, and recorded decisions are kept.</Typography></DialogContent><DialogActions><Button onClick={() => setStopOpen(false)}>Keep running</Button><Button onClick={async () => { setStopOpen(false); await workspace.control('stop'); }}>Stop session</Button></DialogActions></Dialog>
    <Dialog open={autoStartOpen} onClose={() => setAutoStartOpen(false)}><DialogTitle>Start automatic cart additions?</DialogTitle><DialogContent><Typography variant="body2">Qualified offers will be added without per-book confirmation. You can pause or stop here. At the batch limit, you will be asked to complete checkout in Amazon before continuing.</Typography></DialogContent><DialogActions><Button onClick={() => setAutoStartOpen(false)}>Cancel</Button><Button onClick={() => { setAutoStartOpen(false); start('auto'); }}>Start auto mode</Button></DialogActions></Dialog>
  </Stack>;
}

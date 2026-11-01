import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControl, InputLabel, List, ListItemButton, ListItemText, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';
import DataGrid from './DashboardDataGrid';
import VpsDashboard from './VpsDashboard';
import VpsRecentCards from './VpsRecentCards';
import VpsLogs, { VpsActivity } from './VpsLogs';
import { initialVps, useVpsWorkspace } from './lib/useVpsWorkspace';
import { vpsStateStyle, vpsStopStyle, vpsResumeStyle } from './lib/vpsStyles';

const scrapers = ['atlanticbooks','bookchor','bookswagon','flipkart','mypustak','ompublication','sapnaonline','abebooks','abebooks-co-uk','abebooks-google','walmart','amazon-in','amazon-com','amazon-uk','amazon-it'];
const gib = value => value == null ? '—' : `${(value / 1024 ** 3).toFixed(1)} GiB`;
async function api(body) {
  const response=await fetch('/api/vps-manager',body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {});
  const data=await response.json(); if(!response.ok) throw new Error(data.error || 'Request failed.'); return data;
}
export default function VpsManager() {
  const [servers,setServers]=useState([]), [server,setServer]=useState(initialVps), [status,setStatus]=useState(null), [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('');
  const [folder,setFolder]=useState('input-data'), [items,setItems]=useState([]), [input,setInput]=useState(''), [scraper,setScraper]=useState('atlanticbooks'), [dialog,setDialog]=useState('');
  const [control,setControl]=useState(null), [activityOpen,setActivityOpen]=useState(false);
  const [sheetOpen,setSheetOpen]=useState(false), [setupOpen,setSetupOpen]=useState(false), [chosenServer,setChosenServer]=useState(server), [showProcesses,setShowProcesses]=useState(false);
  const workspace=useVpsWorkspace(servers,server,setStatus);
  useEffect(()=>{api().then(data=>{setServers(data.servers);if(data.servers.length && !data.servers.some(s=>s.id===server))setServer(data.servers[0].id);}).catch(e=>setError(e.message));},[]);
  async function operation(op, extra={}) {setBusy(true);setError('');if(!['status','files'].includes(op))setMessage('');try {return await api({server,op,...extra});} catch(e){setError(e.message);return null;}finally{setBusy(false);}}
  async function refresh(){const data=await operation('status',{reconnect:true});if(data)setStatus(data);}
  useEffect(()=>{setInput('');setItems([]);setFolder('input-data');setSetupOpen(false);setControl(null);setError('');setMessage('');},[server]);
  async function browse(dir){const data=await operation('files',{folder:dir});if(data){setFolder(dir);setItems(data.items);setDialog('files');}}
  async function sync(){setDialog('');const data=await operation('sync');if(data){setMessage(`${data.message} ${data.commit.slice(0,12)}`);await refresh();}}
  async function launch(){setDialog('');setSetupOpen(false);const data=await operation('launch',{input,scraper});if(data){setMessage(`Started ${data.scraper} in ${data.session}. Output: ${data.output}`);await refresh();}}
  async function controlJob(selected=control){setControl(null);const extra={job:selected.row.control_id};if(['retry','clear-pause'].includes(selected.op))extra.scraper=selected.row.scraper;const data=await operation(selected.op,extra);if(data){await refresh();setMessage(data.message);}}
  const columns=[{field:'scraper',headerName:'Scraper',width:130},{field:'state',headerName:'Session',width:100,renderCell:({value})=><Chip size="small" variant="outlined" label={value} sx={vpsStateStyle(value)}/>},
    {field:'controls',headerName:'VPS controls',width:330,sortable:false,filterable:false,renderCell:({row})=><Stack direction="row" alignItems="center" sx={{height:'100%'}}>{row.can_stop&&<Button size="small" sx={vpsStopStyle} disabled={busy} onClick={()=>setControl({row,op:'stop'})}>{row.shared?'Stop batch':'Stop'}</Button>}{row.can_resume&&<Button size="small" sx={vpsResumeStyle} disabled={busy} onClick={()=>setControl({row,op:'resume'})}>{row.shared?'Resume batch':'Resume'}</Button>}{row.can_retry&&<Button size="small" sx={vpsResumeStyle} disabled={busy} onClick={()=>row.shared?setControl({row,op:'retry'}):controlJob({row,op:'retry'})}>Retry now</Button>}{row.can_clear_pause&&<Button size="small" sx={{color:'#f0c987','&:hover':{bgcolor:'#383020'}}} disabled={busy} onClick={()=>controlJob({row,op:'clear-pause'})}>Remove pause</Button>}{!row.can_stop&&!row.can_resume&&!row.can_retry&&!row.can_clear_pause&&<Typography variant="caption" color="text.secondary">{row.state==='Finished'?'Completed':row.resume_after?'Cooldown':'—'}</Typography>}</Stack>},
    {field:'logs',headerName:'Logs',width:110,sortable:false,filterable:false,renderCell:({row})=><Button size="small" onClick={()=>{workspace.setLogPaused(false);workspace.setLogJob(row);}}>View logs</Button>},
    {field:'failure',headerName:'Latest recorded failure',width:270,renderCell:({row})=><Typography variant="caption" title={row.failure?.message||''} sx={{overflow:'hidden',textOverflow:'ellipsis'}}>{row.failure?.message||row.pause_reason||(row.state==='Failed'?'Reason unavailable':'—')}</Typography>},
    {field:'input',headerName:'Input',minWidth:200,flex:1},{field:'processed',headerName:'Processed',type:'number',width:100},{field:'total',headerName:'Input rows',type:'number',width:100},{field:'matched',headerName:'Matched',type:'number',width:90},{field:'blocked',headerName:'Blocked',type:'number',width:85},{field:'errors',headerName:'Errors',type:'number',width:85},{field:'output',headerName:'Output',minWidth:220,flex:1}];
  const processColumns=[{field:'pid',headerName:'PID',width:100},{field:'name',headerName:'Process',flex:1},{field:'rss_bytes',headerName:'RAM',width:130,valueFormatter:v=>gib(v)},{field:'parent_pid',headerName:'Parent PID',width:120}];
  function openServer(id) { setShowProcesses(false);workspace.touch(id);setServer(id);setSheetOpen(true);setDialog(''); }
  function chooseServer() {setChosenServer(server);setDialog('servers');}
  function closeSheet() {if(!busy){setSheetOpen(false);workspace.setLogJob(null);setControl(null);}}
  const connection=workspace.connections[server];
  return <Stack spacing={2.5}>
    <Stack direction={{xs:'column',sm:'row'}} justifyContent="space-between" alignItems={{sm:'center'}} spacing={2}>
      <Box><Typography variant="overline" color="text.secondary">REMOTE WORKSPACE</Typography><Typography variant="h4">VPS management</Typography><Typography variant="body2" color="text.secondary" sx={{mt:1}}>Open a server to inspect scraper jobs and processes.</Typography></Box>
      <Button variant="outlined" onClick={chooseServer} disabled={busy||!servers.length}>Choose VPS</Button>
    </Stack>
    <VpsRecentCards workspace={workspace} servers={servers} selected={sheetOpen?server:null} disabled={busy} onOpen={openServer}/>
    {!sheetOpen&&error&&<Alert severity="error">{error}</Alert>}
    <Drawer anchor="bottom" open={sheetOpen} onClose={closeSheet} PaperProps={{role:'dialog','aria-labelledby':'vps-sheet-title',sx:{height:'92dvh',maxHeight:'calc(100dvh - 24px)',borderRadius:'20px 20px 0 0',bgcolor:'background.default',backgroundImage:'none',borderTop:'1px solid',borderColor:'divider'}}}>
      <Box sx={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>
        <Box sx={{pt:1.25,pb:2,px:{xs:2,md:3},borderBottom:'1px solid',borderColor:'divider'}}>
          <Box aria-hidden="true" sx={{width:44,height:4,borderRadius:2,bgcolor:'#666666',mx:'auto',mb:1.5}}/>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center"><Typography id="vps-sheet-title" variant="h6">VPS {server}</Typography><Chip size="small" variant="outlined" label={connection?.state||workspace.streamState}/>{busy&&<CircularProgress size={18}/>}</Stack>
            <Button onClick={closeSheet} disabled={busy}>Close server</Button>
          </Stack>
          <Stack direction="row" spacing={1} sx={{mt:1.5,flexWrap:'wrap',gap:0.5}}>
            <Button variant="contained" disabled={busy||!status} onClick={()=>setSetupOpen(true)}>Start scraper</Button>
            <Button variant="outlined" disabled={busy} onClick={refresh}>{busy?'Working…':'Connect / refresh'}</Button>
            <Button disabled={busy} onClick={chooseServer}>Change VPS</Button>
            <Button disabled={busy||!status} onClick={()=>setDialog('sync')}>Sync Git</Button>
            <Button onClick={()=>setActivityOpen(true)}>Activity</Button>
            {server==='6'&&<Button onClick={()=>setDialog('legacy')}>View existing VPS 6 batch</Button>}
          </Stack>
        </Box>
        <Stack spacing={2.5} sx={{flex:1,minHeight:0,overflowY:'auto',p:{xs:2,md:3},pb:4}}>
          {error&&<Alert severity="error">{error}</Alert>}{message&&<Alert severity="success">{message}</Alert>}
          {connection?.error&&<Alert severity="warning">{connection.error}</Alert>}
          {!status&&<Typography color="text.secondary">{connection?.error?'Server details are unavailable. Reconnect to try again.':'Loading server details…'}</Typography>}
          {status&&<>
            <Paper variant="outlined" sx={{overflow:'hidden',flexShrink:0}}>
              <Box sx={{p:2.5}}><Typography variant="h6">Scraper jobs</Typography><Typography variant="caption" color="text.secondary">Stop and resume scrapers on this VPS. Shared batch controls affect every scraper in that Node process. Status updates automatically.</Typography></Box>
              <Divider/><Box sx={{height:420}}><DataGrid rows={status.jobs} columns={columns} getRowId={r=>r.id} disableRowSelectionOnClick initialState={{pagination:{paginationModel:{pageSize:10}}}} pageSizeOptions={[10,25,50]}/></Box>
            </Paper>
            <Paper variant="outlined" sx={{overflow:'hidden',flexShrink:0}}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{p:2.5}}><Typography variant="h6">Server processes</Typography><Button onClick={()=>setShowProcesses(value=>!value)} aria-expanded={showProcesses} aria-controls="vps-process-details">{showProcesses?'Hide processes':'Show processes'}</Button></Stack>
              <Collapse in={showProcesses} unmountOnExit id="vps-process-details" role="region" aria-label="Server process details">
                <Box sx={{px:2.5,pb:2.5}}><Typography variant="body2">Processes: {status.process_count.toLocaleString()} · Available RAM: {gib(status.memory?.MemAvailable)} / {gib(status.memory?.MemTotal)} · Swap used: {gib(status.memory?.SwapTotal-status.memory?.SwapFree)}</Typography><Typography variant="caption" color="text.secondary" display="block" sx={{mt:0.75}}>Git: {status.git.branch||'unknown branch'} · {status.git.commit?.slice(0,12)} · {status.git.dirty?'uncommitted changes':'clean'} · tmux sessions: {status.sessions.length} · {status.checked_at?`Updated ${new Date(status.checked_at).toLocaleTimeString()}`:'Snapshot time unavailable'}</Typography><Typography variant="caption" color="text.secondary" display="block" sx={{mt:0.75}}>Largest processes by resident memory (first 100). Process information is read-only.</Typography></Box>
                <Divider/><Box sx={{height:340}}><DataGrid rows={status.processes} getRowId={r=>r.pid} columns={processColumns} disableRowSelectionOnClick initialState={{pagination:{paginationModel:{pageSize:10}}}} pageSizeOptions={[10,25,50]}/></Box>
              </Collapse>
            </Paper>
          </>}
        </Stack>
      </Box>
    </Drawer>
    <VpsLogs workspace={workspace} server={server}/><VpsActivity open={activityOpen} onClose={()=>setActivityOpen(false)} entries={workspace.activity} server={server}/>
    <Dialog open={dialog==='servers'} onClose={()=>!busy&&setDialog('')} fullWidth maxWidth="sm"><DialogTitle>Choose VPS</DialogTitle><DialogContent dividers><Typography variant="body2" color="text.secondary" sx={{mb:2}}>Select a server to open its workspace.</Typography><FormControl fullWidth size="small"><InputLabel id="vps-chooser-server-label">Server</InputLabel><Select labelId="vps-chooser-server-label" label="Server" disabled={busy} value={chosenServer} onChange={e=>setChosenServer(e.target.value)}>{servers.map(s=><MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</Select></FormControl></DialogContent><DialogActions><Button disabled={busy} onClick={()=>setDialog('')}>Cancel</Button><Button variant="contained" disabled={busy||!servers.some(s=>s.id===chosenServer)} onClick={()=>openServer(chosenServer)}>Open server</Button></DialogActions></Dialog>
    <Dialog open={setupOpen&&dialog!=='files'&&dialog!=='launch'} onClose={()=>!busy&&setSetupOpen(false)} fullWidth maxWidth="md"><DialogTitle>Start scraper on VPS {server}</DialogTitle><DialogContent dividers><Typography variant="body2" color="text.secondary" sx={{mb:2.5}}>Choose a file already on this VPS. Jobs run headless in tmux and resume from saved output.</Typography><Stack spacing={2}><FormControl fullWidth size="small"><InputLabel id="vps-setup-scraper-label">Scraper</InputLabel><Select labelId="vps-setup-scraper-label" label="Scraper" disabled={busy} value={scraper} onChange={e=>setScraper(e.target.value)}>{scrapers.map(s=><MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl><Box><Button variant="outlined" disabled={busy} onClick={()=>browse(folder)}>Choose input on VPS</Button><Typography variant="body2" sx={{mt:1.5,overflowWrap:'anywhere'}}>{input||'No input selected'}</Typography></Box></Stack>{error&&<Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent><DialogActions><Button disabled={busy} onClick={()=>setSetupOpen(false)}>Cancel</Button><Button variant="contained" disabled={busy||!input} onClick={()=>setDialog('launch')}>Review & start</Button></DialogActions></Dialog>
    <Dialog open={dialog==='legacy'} onClose={()=>setDialog('')} fullWidth maxWidth="xl"><DialogTitle>Existing VPS 6 batch</DialogTitle><DialogContent dividers>{dialog==='legacy'&&server==='6'&&<VpsDashboard/>}</DialogContent><DialogActions><Button onClick={()=>setDialog('')}>Close batch details</Button></DialogActions></Dialog>
    <Dialog open={dialog==='files'} onClose={()=>setDialog('')} fullWidth maxWidth="sm"><DialogTitle>Select remote input</DialogTitle><DialogContent dividers><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="body2" sx={{overflowWrap:'anywhere'}}>{folder}</Typography><Button disabled={folder==='input-data'||busy} onClick={()=>browse(folder.split('/').slice(0,-1).join('/'))}>Up</Button></Stack>{error&&<Alert severity="error" sx={{mt:1}}>{error}</Alert>}{busy&&<Typography variant="caption" color="text.secondary">Reading folder…</Typography>}<List sx={{maxHeight:380,overflowY:'auto'}}>{items.map(item=><ListItemButton disabled={busy} key={item.path} onClick={()=>item.type==='folder'?browse(item.path):(setInput(item.path),setDialog(''))}><ListItemText primary={item.name} secondary={item.type}/></ListItemButton>)}</List>{!items.length&&<Typography color="text.secondary">No supported files or folders.</Typography>}</DialogContent><DialogActions><Button onClick={()=>setDialog('')}>Cancel</Button></DialogActions></Dialog>
    <Dialog open={dialog==='sync'} onClose={()=>setDialog('')}><DialogTitle>Sync repository on VPS {server}?</DialogTitle><DialogContent><Typography>Fetch origin/main and fast-forward only when it matches your local committed HEAD. A dirty checkout or running scraper prevents an update.</Typography></DialogContent><DialogActions><Button onClick={()=>setDialog('')}>Cancel</Button><Button onClick={sync}>Sync Git</Button></DialogActions></Dialog>
    <Dialog open={dialog==='launch'} onClose={()=>setDialog('')}><DialogTitle>Start scraper on VPS {server}?</DialogTitle><DialogContent><Typography>Scraper: {scraper}</Typography><Typography sx={{overflowWrap:'anywhere'}}>Input: {input}</Typography><Typography variant="body2" color="text.secondary" sx={{mt:2}}>The job will run headless in tmux. Existing compatible dashboard output will resume; conflicting output will be rejected.</Typography></DialogContent><DialogActions><Button onClick={()=>setDialog('')}>Cancel</Button><Button onClick={launch}>Start scraper</Button></DialogActions></Dialog>
    <Dialog open={!!control} onClose={()=>setControl(null)} fullWidth maxWidth="sm"><DialogTitle>{control?.op==='stop'?'Stop':control?.op==='retry'?'Retry':'Resume'} {control?.row.shared?'shared scraper batch':control?.row.scraper} on VPS {server}?</DialogTitle><DialogContent>
      {control?.row.shared&&<Alert severity="warning" sx={{mb:2}}>These scrapers share one Node process. This action applies to the entire batch: {control.row.group_scrapers?.join(', ')}.</Alert>}
      <Typography>{control?.op==='stop'?'Stop the remote scraper process and its browser children. Saved output files will be preserved.':control?.op==='retry'?`Remove the saved pause for ${control.row.scraper} and retry its pending input. Other scrapers keep their saved progress and cooldowns.`:'Run the saved remote command again with its original input and output paths. Scrapers resume from their saved progress.'}</Typography>
      {control?.op==='retry'&&control?.row.pause_reason&&<Typography variant="body2" color="text.secondary" sx={{mt:1}}>Previous block: {control.row.pause_reason}</Typography>}
      <Typography variant="body2" sx={{mt:2,overflowWrap:'anywhere'}}>Input: {control?.row.input}</Typography>
      {!control?.row.shared&&<Typography variant="body2" sx={{overflowWrap:'anywhere'}}>Output: {control?.row.output}</Typography>}
      {control?.op==='resume'&&control?.row.shared&&<Typography variant="body2" color="text.secondary" sx={{mt:2}}>Each platform keeps its own block cooldown. Completed platforms stay completed.</Typography>}
    </DialogContent><DialogActions><Button onClick={()=>setControl(null)}>Cancel</Button><Button variant="contained" sx={control?.op==='stop'?{bgcolor:'#bf4e59',color:'#ffffff','&:hover':{bgcolor:'#a93e49'}}:{bgcolor:'#80cfa2',color:'#14251b','&:hover':{bgcolor:'#9be1b5'}}} onClick={()=>controlJob()}>{control?.op==='stop'?'Stop on VPS':control?.op==='retry'?'Retry now on VPS':'Resume on VPS'}</Button></DialogActions></Dialog>
  </Stack>;
}

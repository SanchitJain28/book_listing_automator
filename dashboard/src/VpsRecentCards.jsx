import { useState } from 'react';
import { Box, Button, Card, CardActionArea, CardContent, Chip, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import { vpsStateStyle, vpsWorkloadStyle } from './lib/vpsStyles';
import { sortVpsIds } from './lib/vpsCardSort';
export default function VpsRecentCards({ workspace, servers, selected, onOpen, disabled = false }) {
  const [sort, setSort] = useState('sequence');
  const ids = sortVpsIds(servers, workspace, sort);
  return <Box><Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
    <Typography variant="overline" color="text.secondary">Servers</Typography>
    <FormControl size="small" sx={{minWidth:160}}><InputLabel id="vps-card-sort-label">Sort by</InputLabel><Select labelId="vps-card-sort-label" label="Sort by" value={sort} onChange={event=>setSort(event.target.value)}>
      <MenuItem value="sequence">Sequence (1, 2, 3)</MenuItem><MenuItem value="recent">Recent</MenuItem><MenuItem value="idle">Idle</MenuItem><MenuItem value="busy">Busy</MenuItem>
    </Select></FormControl>
  </Stack><Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'repeat(2,1fr)',lg:'repeat(3,1fr)'},gap:1.5,mt:1}}>{ids.map(id=>{
    const summary=workspace.summaries[id],connection=workspace.connections[id]?.state||'Not connected';
    const jobs=summary?.jobs||[];const state=connection==='Connected'?'Running':/failed|rejected/i.test(connection)?'Blocked':'Queued';
    const running=summary?.jobs?jobs.filter(j=>j.state==='Running').length:null;
    const workload=vpsWorkloadStyle(running);
    const checked=summary?.checked_at?new Date(summary.checked_at):null;const stale=!checked||Date.now()-checked.getTime()>45000;
    return <Card key={id} variant="outlined" sx={{borderColor:id===selected?'text.secondary':workload.borderColor,bgcolor:'background.paper',backgroundImage:workload.backgroundImage,transition:'background-image 200ms, border-color 200ms'}}><CardActionArea disabled={disabled} onClick={()=>onOpen(id)} aria-label={`Open VPS ${id}`}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">VPS {id}</Typography><Chip size="small" variant="outlined" label={connection} sx={vpsStateStyle(state)}/></Stack><Typography variant="body2" sx={{mt:1.5}}>{summary?`${running ?? 0} running · ${jobs.filter(j=>j.state==='Blocked').length} blocked · ${jobs.filter(j=>j.state==='Failed').length} failed`:'Open to load server status'}</Typography><Typography variant="body2" color="text.secondary" sx={{mt:0.5}}>Available RAM: {summary?.memory?.MemAvailable!=null?`${(summary.memory.MemAvailable/1024**3).toFixed(1)} GiB`:'—'}</Typography><Typography variant="caption" color="text.secondary">{checked?`Updated ${checked.toLocaleTimeString()}${stale?' · stale':''}`:'No recent snapshot'}</Typography></CardContent></CardActionArea><Stack direction="row" alignItems="center" justifyContent="space-between" sx={{pl:1,pr:2,pb:0.5}}><Button size="small" onClick={()=>workspace.pin(id)}>{workspace.recent.find(r=>r.id===id)?.pinned?'Unpin':'Pin'}</Button><Typography variant="caption" sx={{color:workload.color}}>{workload.label}</Typography></Stack></Card>;
  })}</Box></Box>;
}

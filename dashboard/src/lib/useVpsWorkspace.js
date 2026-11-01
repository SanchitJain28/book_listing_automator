import { useEffect, useRef, useState } from 'react';
const key = 'book-workspace-vps-recents-v1';
const cache = new Map();
export function loadRecent() { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter(r => /^\d+$/.test(r.id) && Number.isFinite(r.opened)) : []; } catch { return []; } }
export function initialVps() { return loadRecent().sort((a,b)=>b.opened-a.opened)[0]?.id || '6'; }
export function useVpsWorkspace(servers, server, setStatus) {
  const [recent, setRecent] = useState(loadRecent), [summaries, setSummaries] = useState(()=>Object.fromEntries(loadRecent().filter(r=>r.summary).map(r=>[r.id,r.summary]))), [connections, setConnections] = useState({}), [activity, setActivity] = useState([]), [streamState, setStreamState] = useState('Connecting');
  const [logAttempt,setLogAttempt]=useState('current');
  const [logJob, setLogJob] = useState(null), [logSource, setLogSource] = useState('auto'), [logPaused, setLogPaused] = useState(false), [logData, setLogData] = useState({ entries: [] });
  const [visible, setVisible] = useState(!document.hidden);
  const cursors = useRef({});
  const recentIds = recent.filter(r=>servers.some(s=>s.id===r.id)).sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||b.opened-a.opened).map(r=>r.id);
  const ids = [...new Set([server,...recentIds])].filter(id=>servers.some(s=>s.id===id));
  function save(rows) { setRecent(rows); try { localStorage.setItem(key, JSON.stringify(rows)); } catch {} }
  function touch(id) { const rows = loadRecent(); save([{ ...(rows.find(r=>r.id===id)||{}), id, opened: Date.now() }, ...rows.filter(r=>r.id!==id)]); }
  function pin(id) { const rows = loadRecent(); const old = rows.find(r=>r.id===id); save([{ ...old, id, opened:old?.opened || Date.now(), pinned:!old?.pinned }, ...rows.filter(r=>r.id!==id)]); }
  useEffect(()=>{const handler=()=>setVisible(!document.hidden); document.addEventListener('visibilitychange',handler);return()=>document.removeEventListener('visibilitychange',handler);},[]);
  useEffect(()=>{if(!servers.some(s=>s.id===server))return;setStatus(cache.get(server)||null);touch(server);setLogJob(null);setLogAttempt('current');setActivity([]);},[server,servers.length]);
  const logKey = logJob ? `${server}:${logJob.control_id}:${logJob.scraper}:${logSource}:${logAttempt}` : '';
  useEffect(()=>{setLogData({entries:[]});delete cursors.current[logKey];},[logKey]);
  useEffect(()=>{
    if(!visible||!ids.length)return;
    const query=new URLSearchParams({servers:ids.join(','),selected:server});
    if(logJob&&!logPaused){query.set('job',logJob.control_id);query.set('scraper',logJob.scraper);query.set('source',logSource);query.set('attempt',logAttempt);if(cursors.current[logKey])query.set('cursor',cursors.current[logKey]);}
    let disposed=false;
    const events=new EventSource('/api/vps-events?'+query);
    events.onopen=()=>{if(!disposed)setStreamState('Live');};events.onerror=()=>{if(!disposed)setStreamState('Reconnecting');};
    events.addEventListener('status',event=>{if(disposed)return;const {server:id,data}=JSON.parse(event.data);cache.set(id,data);try{const rows=loadRecent();const row=rows.find(r=>r.id===id);if(row){row.summary={checked_at:data.checked_at,memory:data.memory,jobs:(data.jobs||[]).map(j=>({state:j.state}))};localStorage.setItem(key,JSON.stringify(rows));}}catch{}setSummaries(previous=>({...previous,[id]:data}));if(id===server){setStatus(data);setLogJob(old=>old?(data.jobs?.find(j=>j.id===old.id)||old):null);}});
    events.addEventListener('connection',event=>{if(disposed)return;const value=JSON.parse(event.data);setConnections(previous=>({...previous,[value.server]:value}));});
    events.addEventListener('activity',event=>{if(!disposed)setActivity(JSON.parse(event.data).entries||[]);});
    events.addEventListener('logs',event=>{if(disposed)return;const {data}=JSON.parse(event.data);if(data.cursor)cursors.current[logKey]=data.cursor;setLogData(old=>{const rows=data.reset?[]:old.entries;const seen=new Set(rows.map(r=>r.id));return {...data,entries:[...rows,...(data.entries||[]).filter(r=>!seen.has(r.id))].slice(-2000)};});});
    return()=>{disposed=true;events.close();};
  },[server,ids.join(','),visible,logKey,logPaused]);
  return {recent, cards:recentIds, summaries,connections,activity,streamState:visible?streamState:'Paused while tab is hidden',pin,touch,logAttempt,setLogAttempt,logJob,setLogJob,logSource,setLogSource,logPaused,setLogPaused,logData};
}

"""Dashboard VPS operations. Invoked over SSH with a validated JSON request."""
import base64, fcntl, hashlib, json, os, re, shlex, subprocess, sys, time
from pathlib import Path
ROOT = Path('/root/book_listing_automator')
STATE = Path.home() / '.book-listing-dashboard'
SCRIPTS = {name: 'scrapers/{0}/{0}-isbn.js'.format(name) for name in ['atlanticbooks','bookchor','bookswagon','flipkart','mypustak','ompublication','sapnaonline','abebooks','walmart']}
SCRIPTS.update({'amazon-in':'scrapers/amazon-isbn/amazon-isbn.js','amazon-com':'scrapers/amazon-us-isbn/amazon-us-isbn.js','amazon-uk':'scrapers/amazon-uk-isbn/amazon-uk-isbn.js'})
LEGACY = {'abebooks','amazon-in'}

def run(*args, check=True, timeout=30):
    p = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    if check and p.returncode: raise ValueError((p.stderr or p.stdout or 'Command failed').strip()[-1000:])
    return p.stdout.strip()

def safe_path(value, prefix):
    if not isinstance(value,str) or not value.startswith(prefix+'/') or '\\' in value or '\0' in value: raise ValueError('Invalid project path.')
    parts = Path(value).parts
    if any(part in ('.','..') or part.startswith('.') for part in parts): raise ValueError('Invalid project path.')
    target = ROOT / value
    current = ROOT
    for part in parts:
        current = current / part
        if current.is_symlink(): raise ValueError('Symbolic links are not supported.')
    if not target.resolve().is_relative_to((ROOT / prefix).resolve()): raise ValueError('Path outside allowed folder.')
    return target

def jobs():
    if not STATE.exists(): return []
    found=[]
    for f in sorted(STATE.glob('*.json'),reverse=True):
        try: found.append(json.loads(f.read_text()))
        except (ValueError,OSError): continue
    return found

def live_sessions():
    return set(run('tmux','list-sessions','-F','#{session_name}',check=False).splitlines())

def process_info():
    data=[]
    for line in run('ps','-eo','pid=,ppid=,rss=,comm=','--sort=-rss').splitlines():
        p=line.split(None,3)
        if len(p)==4:
            try: data.append({'pid':int(p[0]),'parent_pid':int(p[1]),'rss_bytes':int(p[2])*1024,'name':p[3]})
            except ValueError: pass
    return data

def output_stats(path):
    rows=0; matches=0; errors=0; blocks=0; bad=0; last=None
    if path.exists():
        with path.open('rb') as f:
            for raw in f:
                if not raw.endswith(b'\n'): break
                if not raw.strip(): continue
                try:
                    row=json.loads(raw); rows+=1
                    listings=[entry for entry in row.get('listings',[]) if isinstance(entry,dict)] if isinstance(row.get('listings'),list) else []
                    matches += row.get('isbn_matched') is True or row.get('isbn_match') is True or any(entry.get('isbn_match') is True or entry.get('isbn_matched') is True for entry in listings)
                    status=' '.join(str(entry.get(key) or '') for entry in [row]+listings for key in ('stock_status','error','error_code'))
                    block=bool(re.search(r'blocked|captcha|robot|rate.limit|http\s*(403|429|503)',status,re.I))
                    failure=bool(row.get('error')) or str(row.get('title','')).lower()=='error' or str(row.get('stock_status','')).lower()=='error' or any(entry.get('error') or str(entry.get('price','')).lower()=='error' for entry in listings)
                    blocks+=block; errors+=not block and bool(failure);last=row.get('searched_isbn') or row.get('isbn')
                except (ValueError,UnicodeDecodeError,AttributeError): bad+=1
    return dict(processed=rows,matched=matches,errors=errors,blocked=blocks,invalid_lines=bad,last_isbn=last)

def discover_jobs():
    """Discover compatible already-running CLI jobs without exposing process arguments."""
    result=[]
    for line in run('ps','-eo','pid=,args=',check=False).splitlines():
        parts=line.strip().split(None,1)
        if len(parts)!=2: continue
        try: pid=int(parts[0]); args=shlex.split(parts[1])
        except (ValueError,TypeError): continue
        if len(args)<3 or Path(args[0]).name!='node': continue
        script=args[1]
        if script.startswith(str(ROOT)+'/'): script=script[len(str(ROOT))+1:]
        if script=='scripts/run-shared-scrapers.js':
            directory=ROOT/'output/shared-runs'
            for path in directory.glob('*.status.json') if directory.exists() else []:
                try:
                    snapshot=json.loads(path.read_text())
                    if snapshot.get('pid')!=pid: continue
                    rel=args[2]; rel=str(Path(rel).relative_to(ROOT)) if Path(rel).is_absolute() else rel
                    safe_path(rel,'input-data')
                    for name,row in snapshot.get('scrapers',{}).items():
                        out=Path(row['output']); outrel=str(out.relative_to(ROOT)) if out.is_absolute() else str(out)
                        output=safe_path(outrel,'output'); metrics=output_stats(output)
                        attempts=Path(str(output)+'.blocked.jsonl')
                        if attempts.exists(): metrics['blocked']+=output_stats(attempts)['processed']
                        result.append({'id':f'external-{pid}-{name}','scraper':name,'input':rel,'output':outrel,'total':row.get('total',0),'state':row.get('state','Unknown'),'running':row.get('state')=='Running',**metrics})
                except (OSError,ValueError,KeyError,TypeError): continue
            continue
        names=[name for name,filename in SCRIPTS.items() if filename==script]
        if not names: continue
        try:
            rel=args[2]; rel=str(Path(rel).relative_to(ROOT)) if Path(rel).is_absolute() else rel
            inp=safe_path(rel,'input-data')
            if not inp.is_file(): continue
            if '--output' in args:
                raw=Path(args[args.index('--output')+1]); outrel=str(raw.relative_to(ROOT)) if raw.is_absolute() else str(raw)
            else: outrel='output/'+str(Path(rel).relative_to('input-data').with_suffix('.json'))
            output=safe_path(outrel,'output')
            with inp.open('rb') as f: total=sum(1 for row in f if row.strip())
            result.append({'id':f'external-{pid}','scraper':names[0],'input':rel,'output':outrel,'total':total,'state':'Running','running':True,**output_stats(output)})
        except (OSError,ValueError,IndexError,TypeError): continue
    return result

def status():
    sessions=live_sessions(); result=[]
    for job in jobs():
        output=safe_path(job['output'],'output'); metrics=output_stats(output)
        sidecar=Path(str(output)+'.blocked.jsonl')
        if sidecar.exists(): metrics['blocked'] += output_stats(sidecar)['processed']
        pause_file=Path(str(output)+'.pause.json'); pause=None
        if pause_file.exists():
            try: pause=json.loads(pause_file.read_text())
            except (OSError,ValueError): pass
        exit_file=STATE/(job['id']+'.exit')
        try: exit_code=int(exit_file.read_text().strip())
        except (OSError,ValueError): exit_code=None
        running=job['session'] in sessions
        state='Running' if running else 'Blocked' if pause and exit_code==3 else 'Finished' if exit_code in (0,2) else 'Failed' if exit_code is not None else 'Stopped'
        if state=='Blocked' and not metrics['blocked']: metrics['blocked']=1
        result.append({**job,'running':running,'state':state,'exit_code':exit_code,'resume_after':pause.get('resume_after') if pause else None,**metrics})
    discovered=discover_jobs()
    managed_pairs={(j['scraper'],j['input']) for j in result if j['running']}
    result.extend(j for j in discovered if (j['scraper'],j['input']) not in managed_pairs)
    processes=process_info()
    memory={}
    for line in Path('/proc/meminfo').read_text().splitlines():
        k,_,v=line.partition(':')
        if k in ('MemTotal','MemAvailable','SwapTotal','SwapFree'): memory[k]=int(v.split()[0])*1024
    return {'jobs':result,'process_count':len(processes),'processes':processes[:100], 'memory':memory, 'sessions':sorted(sessions), 'git':git_state()}

def git_state():
    return {'branch':run('git','branch','--show-current',check=False),'commit':run('git','rev-parse','HEAD',check=False),'dirty':bool(run('git','status','--porcelain',check=False))}

def list_inputs(folder):
    if folder=='input-data': target=ROOT/'input-data'
    else: target=safe_path(folder,'input-data')
    if not target.is_dir(): raise ValueError('Input folder not found.')
    result=[]
    for p in sorted(target.iterdir(),key=lambda p:(not p.is_dir(),p.name.lower())):
        if p.name.startswith('.') or p.is_symlink(): continue
        if p.is_dir() or p.suffix.lower() in ('.txt','.json','.jsonl','.ndjson'):
            result.append({'name':p.name,'path':str(p.relative_to(ROOT)),'type':'folder' if p.is_dir() else 'file'})
    return result[:2000]

def sync(expected):
    if not re.fullmatch(r'[a-f0-9]{40}',str(expected)): raise ValueError('Invalid local commit.')
    state=git_state()
    if state['branch']!='main' or state['dirty']: raise ValueError('Remote checkout must be clean and on main. Preserve and resolve its changes first.')
    run('git','fetch','origin','main',timeout=90)
    remote=run('git','rev-parse','FETCH_HEAD')
    if remote!=expected: raise ValueError('origin/main differs from the local HEAD. Commit and push local changes, or update your local main before syncing.')
    if remote==state['commit']: return {'message':'Already at the local commit.', 'commit':remote}
    active=run('ps','-eo','args=',check=False)
    if re.search(r'\bnode\s+(?:\S*/)?(?:scripts/run-shared-scrapers\.js|scrapers/\S+)',active): raise ValueError('Scraper processes are running. Stop them safely before changing their code.')
    run('git','merge','--ff-only',remote,timeout=60)
    return {'message':'Updated with a fast-forward.', 'commit':run('git','rev-parse','HEAD')}

def launch(req):
    commit=req.get('commit')
    if not re.fullmatch(r'[a-f0-9]{40}',str(commit)) or git_state()['commit']!=commit:
        raise ValueError('The VPS commit differs from your local committed HEAD. Sync the repository before launching.')
    if git_state()['dirty']:
        raise ValueError('The VPS checkout has uncommitted changes. Resolve them before launching.')
    name=req.get('scraper'); rel=req.get('input')
    if name not in SCRIPTS: raise ValueError('Unknown scraper.')
    inp=safe_path(rel,'input-data')
    if not inp.is_file() or inp.suffix.lower() not in ('.txt','.json','.jsonl','.ndjson'): raise ValueError('Select a supported remote input file.')
    if inp.stat().st_size > 50*1024*1024: raise ValueError('Input exceeds 50 MB.')
    script=ROOT/SCRIPTS[name]
    if not script.is_file(): raise ValueError('Scraper is not present on this VPS. Sync the repository first.')
    digest=hashlib.sha256(inp.read_bytes()).hexdigest()
    ident=hashlib.sha256((name+'\0'+rel).encode()).hexdigest()[:16]
    if name in LEGACY: output='output/'+str(Path(rel).relative_to('input-data').with_suffix('.json'))
    else: output=f'output/dashboard/{name}/{ident}/results.jsonl'
    out=safe_path(output,'output'); sessions=live_sessions()
    for j in jobs():
        if j.get('session') in sessions and (j.get('output')==output or (j.get('scraper')==name and j.get('input')==rel)):
            raise ValueError('A dashboard job for this scraper/input or output is already running.')
    # Other launchers do not use dashboard locks. Refuse matching external processes.
    args=run('ps','-eo','args=',check=False)
    if rel in args and ('scripts/run-shared-scrapers.js' in args or SCRIPTS[name] in args): raise ValueError('This input is already used by a matching scraper or shared runner.')
    previous=[j for j in jobs() if j.get('output')==output]
    if out.exists() and (not previous or previous[0].get('input_sha256')!=digest or previous[0].get('input')!=rel or previous[0].get('scraper')!=name):
        raise ValueError('Existing output is not associated with this exact input and scraper. Choose another input or preserve and remove the conflicting output manually.')
    with inp.open('rb') as f: total=sum(1 for line in f if line.strip())
    if not total: raise ValueError('Input file is empty.')
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True); out.parent.mkdir(parents=True,exist_ok=True)
    job_id=f'{int(time.time())}-{ident}'; session='dashboard_'+job_id.replace('-','_'); log=STATE/(job_id+'.log'); exitfile=STATE/(job_id+'.exit'); launcher=STATE/(job_id+'.sh')
    command=['node',SCRIPTS[name],rel,'--headless']
    if name not in LEGACY: command+=['--output',output]
    launcher.write_text('#!/bin/sh\ncd '+shlex.quote(str(ROOT))+' || exit 1\n'+shlex.join(command)+' >> '+shlex.quote(str(log))+' 2>&1\nresult=$?\nprintf "%s\\n" "$result" > '+shlex.quote(str(exitfile))+'\nexit "$result"\n');launcher.chmod(0o700)
    job={'id':job_id,'scraper':name,'input':rel,'input_sha256':digest,'total':total,'output':output,'session':session,'started_at':int(time.time()),'log':str(log)}
    record=STATE/(job_id+'.json'); record.write_text(json.dumps(job)); record.chmod(0o600)
    try: run('tmux','new-session','-d','-s',session,'sh '+shlex.quote(str(launcher)))
    except Exception: record.unlink(); raise
    return job

def main():
    encoded = sys.argv[1]; req=json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)).decode()); op=req.get('op')
    if op=='status': result=status()
    elif op=='files': result={'items':list_inputs(req.get('folder','input-data'))}
    elif op in ('sync','launch'):
        STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
        with (STATE / 'management.lock').open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            result=sync(req.get('commit')) if op=='sync' else launch(req)
    else: raise ValueError('Unknown operation.')
    print(json.dumps({'ok':True,'result':result}))
try: main()
except Exception as e: print(json.dumps({'ok':False,'error':str(e)})); sys.exit(1)

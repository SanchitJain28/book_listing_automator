"""Dashboard VPS operations. Invoked over SSH with a validated JSON request."""
import base64, fcntl, hashlib, json, os, re, shlex, signal, subprocess, sys, time
from pathlib import Path
ROOT = Path('/root/book_listing_automator')
STATE = Path.home() / '.book-listing-dashboard'
SCRIPTS = {name: 'scrapers/{0}/{0}-isbn.js'.format(name) for name in ['atlanticbooks','bookchor','bookswagon','flipkart','mypustak','ompublication','sapnaonline','abebooks','abebooks-co-uk','walmart']}
SCRIPTS.update({'amazon-in':'scrapers/amazon-isbn/amazon-isbn.js','amazon-com':'scrapers/amazon-us-isbn/amazon-us-isbn.js','amazon-uk':'scrapers/amazon-uk-isbn/amazon-uk-isbn.js','amazon-it':'scrapers/amazon-it-isbn/amazon-it-isbn.js'})
SCRIPTS['abebooks-google']='scrapers/abebooks-google/abebooks-google-isbn.js'
ENHANCED_AMAZON = 'amazon-isbn-enchanced'
SCRIPTS[ENHANCED_AMAZON] = f'scrapers/{ENHANCED_AMAZON}/{ENHANCED_AMAZON}.js'
LEGACY = {'abebooks','amazon-in',ENHANCED_AMAZON}
SHARED = 'scripts/run-shared-scrapers.js'

def default_json_output(scraper, input_path):
    folder = Path('output')
    if scraper == ENHANCED_AMAZON:
        folder /= ENHANCED_AMAZON
    return str(folder / Path(input_path).relative_to('input-data').with_suffix('.json'))

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
        try:
            job=json.loads(f.read_text())
            if job.get('kind')!='scraper-process' and all(key in job for key in ('id','scraper','input','output','session')): found.append(job)
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
    """Read appended complete records only; cache identity and counters across SSH channels."""
    empty=dict(processed=0,matched=0,errors=0,blocked=0,invalid_lines=0,last_isbn=None,last_failure=None)
    if not path.exists(): return empty
    folder=STATE/'metrics-cache';folder.mkdir(parents=True,exist_ok=True,mode=0o700)
    key=hashlib.sha256(str(path).encode()).hexdigest()
    cache_file=folder/(key+'.json')
    with (folder/(key+'.lock')).open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        stat=path.stat()
        with path.open('rb') as f:
            signature=hashlib.sha256(f.read(min(4096,stat.st_size))).hexdigest()
            try: cached=json.loads(cache_file.read_text())
            except (OSError,ValueError): cached={}
            valid=(cached.get('inode')==[stat.st_dev,stat.st_ino] and cached.get('offset',0)<=stat.st_size and cached.get('signature')==signature
                   and (cached.get('size')!=stat.st_size or cached.get('mtime')==stat.st_mtime_ns))
            metrics={**empty,**cached.get('metrics',{})} if valid else dict(empty)
            offset=cached.get('offset',0) if valid else 0
            f.seek(offset)
            while True:
                position=f.tell();raw=f.readline(1024*1024)
                if not raw: break
                if not raw.endswith(b'\n'):
                    # A partial append is pending. Oversized completed records count as invalid.
                    if len(raw)==1024*1024:
                        while raw and not raw.endswith(b'\n'): raw=f.readline(1024*1024)
                        if raw.endswith(b'\n'): metrics['invalid_lines']+=1;offset=f.tell();continue
                    f.seek(position);break
                offset=f.tell()
                if not raw.strip(): continue
                try:
                    row=json.loads(raw)
                    if not isinstance(row,dict): raise ValueError('Non-object result')
                    metrics['processed']+=1
                    listings=[entry for entry in row.get('listings',[]) if isinstance(entry,dict)] if isinstance(row.get('listings'),list) else []
                    metrics['matched']+=row.get('isbn_matched') is True or row.get('isbn_match') is True or any(entry.get('isbn_match') is True or entry.get('isbn_matched') is True for entry in listings)
                    status=' '.join(str(entry.get(key) or '') for entry in [row]+listings for key in ('stock_status','error','error_code'))
                    block=bool(re.search(r'blocked|captcha|robot|rate.limit|http\s*(403|429|503)',status,re.I))
                    failure=bool(row.get('error')) or str(row.get('title','')).lower()=='error' or str(row.get('stock_status','')).lower()=='error' or any(entry.get('error') or str(entry.get('price','')).lower()=='error' for entry in listings)
                    metrics['blocked']+=block;metrics['errors']+=not block and bool(failure)
                    metrics['last_isbn']=row.get('searched_isbn') or row.get('isbn')
                    if block or failure: metrics['last_failure']={'message':str(row.get('error') or row.get('stock_status') or 'Recorded extraction error')[:2000],'timestamp':row.get('scraped_at'),'isbn':metrics['last_isbn'],'input_index':row.get('input_index'),'error_code':row.get('error_code')}
                except (ValueError,UnicodeDecodeError,AttributeError,TypeError): metrics['invalid_lines']+=1
        temporary=cache_file.with_suffix('.tmp')
        temporary.write_text(json.dumps({'inode':[stat.st_dev,stat.st_ino],'offset':offset,'size':stat.st_size,'mtime':stat.st_mtime_ns,'signature':signature,'metrics':metrics}))
        temporary.chmod(0o600);temporary.replace(cache_file)
        return metrics

def process_identity(pid):
    """Kernel identity prevents stale PIDs from controlling unrelated processes."""
    try:
        directory=Path('/proc')/str(int(pid)); raw=(directory/'stat').read_text()
        values=raw[raw.rfind(')')+2:].split()
        return {'pid':int(pid),'parent':int(values[1]),'start':values[19],'state':values[0],
                'executable':os.readlink(directory/'exe')}
    except (OSError,ValueError,IndexError,TypeError): return None

def process_spec(executable,cwd,args):
    executable=str(Path(executable).resolve())
    if Path(executable).name not in ('node','nodejs') or Path(cwd).resolve()!=ROOT.resolve() or len(args)<3: return None
    try:
        script=str(Path(args[1]).relative_to(ROOT)) if Path(args[1]).is_absolute() else args[1]
        if script not in set(SCRIPTS.values())|{SHARED}: return None
        if not safe_path(script,'scripts' if script==SHARED else 'scrapers').is_file(): return None
        rel=str(Path(args[2]).relative_to(ROOT)) if Path(args[2]).is_absolute() else args[2]
        inp=safe_path(rel,'input-data')
        if not inp.is_file(): return None
        flags={}; tail=args[3:]; index=0
        while index<len(tail):
            flag=tail[index]
            if flag in ('--headless','--slow','--retry-failed','--retry-zero-links','--no-clearance-reuse'): flags[flag]=True
            elif flag in ('--output','--platforms','--concurrency','--browsers','--batch-size','--resources','--output-subdir') and index+1<len(tail) and not tail[index+1].startswith('--'):
                index+=1;flags[flag]=tail[index]
            else: return None
            index+=1
        if '--output' in flags:
            value=Path(flags['--output']); output=str(value.relative_to(ROOT)) if value.is_absolute() else str(value)
            safe_path(output,'output')
        else: output=None
        if '--output-subdir' in flags: safe_path('output/'+flags['--output-subdir'],'output')
        with inp.open('rb') as f: total=sum(1 for row in f if row.strip())
        shared=script==SHARED
        name=next((name for name,value in SCRIPTS.items() if value==script),None)
        if not shared:
            if not output and name=='walmart': output=f'output/walmart/{Path(rel).parent.name}-{Path(rel).stem}.jsonl'
            elif not output and name=='abebooks-google': output=f'output/abebooks-google/{Path(rel).parent.name if Path(rel).stem=="input" else Path(rel).stem}/results.jsonl'
            elif name in LEGACY or not output: output=default_json_output(name,rel)
            safe_path(output,'output')
        command=[executable,script,rel]+tail
        return {'command':command,'command_key':hashlib.sha256(json.dumps(command).encode()).hexdigest(),'input':rel,
                'input_sha256':hashlib.sha256(inp.read_bytes()).hexdigest(),'total':total,'shared':shared,'scraper':name,'output':output}
    except (OSError,ValueError,KeyError,TypeError): return None

def known_processes():
    result=[]
    for directory in Path('/proc').iterdir():
        if not directory.name.isdigit(): continue
        identity=process_identity(directory.name)
        if not identity or Path(identity['executable']).name not in ('node','nodejs'): continue
        try:
            args=[os.fsdecode(value) for value in (directory/'cmdline').read_bytes().split(b'\0') if value]
            spec=process_spec(identity['executable'],os.readlink(directory/'cwd'),args)
            if spec: result.append((identity,spec))
        except (OSError,ValueError): continue
    return result

def tracked_records():
    result=[]
    if STATE.exists():
        for file in STATE.glob('process-*.json'):
            try:
                record=json.loads(file.read_text())
                if record.get('kind')=='scraper-process' and re.fullmatch(r'process-[a-f0-9]{20}',record.get('id','')): result.append(record)
            except (OSError,ValueError): continue
    return result

def save_record(record):
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
    file=STATE/(record['id']+'.json'); temporary=file.with_suffix('.tmp')
    temporary.write_text(json.dumps(record));temporary.chmod(0o600);temporary.replace(file)

def shared_rows(identity,spec):
    directory=ROOT/'output/shared-runs'
    for file in directory.glob('*.status.json') if directory.exists() else []:
        try:
            snapshot=json.loads(file.read_text())
            if snapshot.get('pid')!=identity['pid']: continue
            rows=[]
            for name,row in snapshot.get('scrapers',{}).items():
                if name not in SCRIPTS: continue
                value=Path(row['output']); output=str(value.relative_to(ROOT)) if value.is_absolute() else str(value)
                safe_path(output,'output')
                rows.append({'scraper':name,'input':spec['input'],'output':output,'total':row.get('total',spec['total'])})
            if rows: return rows,str(file.relative_to(ROOT))
        except (OSError,ValueError,KeyError,TypeError): continue
    return [],None

def discover_groups():
    records=tracked_records(); active=known_processes(); bound=set()
    for identity,spec in active:
        existing=next((r for r in records if r.get('pid')==identity['pid'] and r.get('start')==identity['start']),None)
        if not existing:
            existing=next((r for r in records if r.get('command_key')==spec['command_key'] and r['id'] not in bound and not live_record(r)),None)
        if not existing:
            ident=hashlib.sha256((spec['command_key']+str(identity['pid'])+identity['start']).encode()).hexdigest()[:20]
            rows,status_file=shared_rows(identity,spec) if spec['shared'] else ([{key:spec[key] for key in ('scraper','input','output','total')}],None)
            if not rows: continue
            existing={'kind':'scraper-process','id':'process-'+ident,**spec,'rows':rows,'status_file':status_file,'created_at':int(time.time())};records.append(existing)
        bound.add(existing['id'])
        if existing.get('pid')!=identity['pid'] or existing.get('start')!=identity['start']:
            existing.update(pid=identity['pid'],start=identity['start']);save_record(existing)
    return records

def live_record(record):
    identity=process_identity(record.get('pid',0))
    if not identity or identity['start']!=record.get('start'): return None
    try:
        directory=Path('/proc')/str(identity['pid'])
        args=[os.fsdecode(value) for value in (directory/'cmdline').read_bytes().split(b'\0') if value]
        spec=process_spec(identity['executable'],os.readlink(directory/'cwd'),args)
        return identity if spec and spec['command_key']==record.get('command_key') else None
    except OSError: return None

def pause_for(output,shared=False):
    suffix='.shared-pause.json' if shared else '.pause.json'
    try: return json.loads(Path(str(output)+suffix).read_text())
    except (OSError,ValueError): return {}

def pause_files(output):
    return [Path(str(output)+suffix) for suffix in ('.pause.json','.shared-pause.json')]

def discover_jobs():
    result=[]
    for record in discover_groups():
        identity=live_record(record); live=bool(identity); shared=record['shared']; snapshot={}
        if shared and record.get('status_file'):
            try: snapshot=json.loads(safe_path(record['status_file'],'output').read_text()).get('scrapers',{})
            except (OSError,ValueError): pass
        pending=any(output_stats(safe_path(row['output'],'output'))['processed']<row['total'] for row in record['rows'])
        for row in record['rows']:
            output=safe_path(row['output'],'output'); metrics=output_stats(output)
            attempts=Path(str(output)+'.blocked.jsonl')
            if attempts.exists(): metrics['blocked']+=output_stats(attempts)['processed']
            pause=pause_for(output,shared); until=pause.get('resume_after'); cooling=bool(until and iso_timestamp(until)>time.time())
            has_pause=any(file.exists() for file in pause_files(output))
            finished=metrics['processed']>=row['total']
            if finished: state='Finished'
            elif cooling: state='Blocked'
            elif live and shared: state=snapshot.get(row['scraper'],{}).get('state','Running')
            elif live: state='Running'
            elif snapshot.get(row['scraper'],{}).get('state')=='Failed': state='Failed'
            elif failure_details(record,row,{},pause,metrics).get('exit_code') not in (None,0,2,3): state='Failed'
            else: state='Stopped'
            result.append({**row,**metrics,'id':record['id']+'-'+row['scraper'],'control_id':record['id'],'state':state,'running':live and state=='Running',
                           'process_running':live,'shared':shared,'group_scrapers':[r['scraper'] for r in record['rows']],
                           'can_stop':live,'can_resume':not live and pending and (shared or not cooling),'resume_after':until,
                           'can_clear_pause':has_pause,'can_retry':not finished and (has_pause or state in ('Blocked','Failed')),'pause_reason':pause.get('reason'),'failure':failure_details(record,row,snapshot.get(row['scraper'],{}),pause,metrics)})
    return result

def iso_timestamp(value):
    from datetime import datetime
    try: return datetime.fromisoformat(str(value).replace('Z','+00:00')).timestamp()
    except (ValueError,TypeError): return 0

def control_record(identifier):
    if not isinstance(identifier,str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}',identifier): raise ValueError('Invalid scraper job.')
    records=discover_groups()
    record=next((record for record in records if record['id']==identifier),None)
    if record: return record
    job=next((job for job in jobs() if job['id']==identifier),None)
    if not job or job['scraper'] not in SCRIPTS: raise ValueError('The scraper job no longer exists. Refresh the VPS status.')
    inp=safe_path(job['input'],'input-data');safe_path(job['output'],'output')
    if hashlib.sha256(inp.read_bytes()).hexdigest()!=job.get('input_sha256'): raise ValueError('Input changed since this job was created.')
    executable=run('which','node')
    command=[executable,SCRIPTS[job['scraper']],job['input'],'--headless']
    if job['scraper'] not in LEGACY: command+=['--output',job['output']]
    spec=process_spec(executable,str(ROOT),command)
    if not spec or spec['output']!=job['output']: raise ValueError('Saved job does not match the scraper output path.')
    record={'kind':'scraper-process','id':'process-'+hashlib.sha256(identifier.encode()).hexdigest()[:20],**spec,
            'rows':[{key:job[key] for key in ('scraper','input','output','total')}],'pid':None,'start':None,'created_at':int(time.time()),'legacy_job_id':job['id'],'log':job.get('log'),'attempts':job.get('attempts',[])}
    save_record(record);return record

def browser_children(root):
    identities=[]
    for directory in Path('/proc').iterdir():
        if directory.name.isdigit():
            item=process_identity(directory.name)
            if item: identities.append(item)
    descendants={root['pid']};changed=True
    while changed:
        changed=False
        for item in identities:
            if item['parent'] in descendants and item['pid'] not in descendants:
                descendants.add(item['pid']);changed=True
    return [item for item in identities if item['pid']!=root['pid'] and item['pid'] in descendants
            and re.search(r'ms-playwright|playwright.*cache|chrome-for-testing|chrome-linux|chromium-',item['executable'],re.I)
            and re.search(r'chrome|chromium|crashpad',Path(item['executable']).name,re.I)]

def signal_identity(identity,signum):
    current=process_identity(identity['pid'])
    if current and current['start']==identity['start'] and current['executable']==identity['executable']:
        try: os.kill(identity['pid'],signum)
        except ProcessLookupError: pass

def stop_job(identifier):
    record=control_record(identifier);identity=live_record(record)
    if not identity: raise ValueError('This scraper process has already stopped. Refresh the VPS status.')
    children=browser_children(identity)
    if identity['state']=='T':
        for item in [identity]+children: signal_identity(item,signal.SIGCONT)
    signal_identity(identity,signal.SIGINT)
    deadline=time.monotonic()+12
    while live_record(record) and time.monotonic()<deadline: time.sleep(.25)
    if live_record(record):
        signal_identity(identity,signal.SIGTERM)
        deadline=time.monotonic()+3
        while live_record(record) and time.monotonic()<deadline: time.sleep(.25)
    if live_record(record): signal_identity(identity,signal.SIGKILL)
    for item in children: signal_identity(item,signal.SIGTERM)
    if children:
        time.sleep(.5)
        for item in children: signal_identity(item,signal.SIGKILL)
    record['stopped_at']=int(time.time());save_record(record)
    return {'message':'Stopped the scraper batch; saved outputs are preserved.' if record['shared'] else 'Stopped the scraper; saved output is preserved.',
            'scrapers':[row['scraper'] for row in record['rows']]}

def validate_resume(record,ignore_identity=None,skip_cooldown=False):
    command=record.get('command',[])
    spec=process_spec(command[0] if command else '',str(ROOT),command)
    if not spec or spec['command_key']!=record['command_key']: raise ValueError('The saved scraper command is no longer valid.')
    if spec['input_sha256']!=record['input_sha256']: raise ValueError('Input changed since this run was recorded. Restore the original input before resuming.')
    outputs={row['output'] for row in record['rows']}
    if all(output_stats(safe_path(row['output'],'output'))['processed']>=row['total'] for row in record['rows']): raise ValueError('This scraper has completed its input.')
    if not record['shared'] and not skip_cooldown:
        pause=pause_for(safe_path(record['output'],'output'))
        if iso_timestamp(pause.get('resume_after'))>time.time(): raise ValueError('Scraper cooldown is active until '+pause['resume_after']+'.')
    for identity,active in known_processes():
        if ignore_identity and identity['pid']==ignore_identity['pid'] and identity['start']==ignore_identity['start']: continue
        if active['command_key']==record['command_key'] or active['input']==record['input'] and active['command'][1]==command[1]: raise ValueError('A matching scraper process is already running.')
        active_rows,_=shared_rows(identity,active) if active['shared'] else ([{'output':active['output']}],None)
        if any(row['output'] in outputs for row in active_rows): raise ValueError('A running scraper already writes to this output.')
    for row in record['rows']: safe_path(row['output'],'output')
    return command

def build_launcher(record,command,launcher,exitfile,attempt):
    """Each attempt owns a bounded console log; process command identity stays unchanged."""
    if not globals().get('RUNTIME_SOURCE'):
        log=STATE/(record['id']+'.log')
        launcher.write_text('#!/bin/sh\ncd '+shlex.quote(str(ROOT))+' || exit 1\n'+shlex.join(command)+' >> '+shlex.quote(str(log))+' 2>&1\nresult=$?\nprintf "%s\\n" "$result" > '+shlex.quote(str(exitfile))+'\nexit "$result"\n')
        launcher.chmod(0o700);record['log']=str(log);return
    for name,source in [('runtimeObserver.cjs',RUNTIME_SOURCE),('jobEvents.js',EVENTS_SOURCE),('consoleSink.py',SINK_SOURCE)]:
        file=STATE/name
        if file.is_symlink(): raise ValueError('Runtime file cannot be a symlink.')
        file.write_text(source);file.chmod(0o600)
    log=STATE/'logs'/record['id']/(attempt+'.log');log.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    rows=record.get('rows') or [record]
    events=str(safe_path(rows[0]['output'],'output'))+'.events.jsonl' if not record.get('shared') else str(STATE/(record['id']+'.batch.events.jsonl'))
    scraper='shared-batch' if record.get('shared') else (record.get('scraper') or rows[0].get('scraper'))
    env={'BOOK_JOB_ID':record['id'],'BOOK_ATTEMPT_ID':attempt,'BOOK_EVENTS_FILE':events,'BOOK_SCRAPER':scraper,
         'BOOK_SERVER_ID':str(globals().get('SERVER_ID','')),'NODE_OPTIONS':'--require='+str(STATE/'runtimeObserver.cjs')}
    for key,value in env.items():
        if not isinstance(value,str): raise ValueError('Cannot start scraper: invalid runtime metadata for '+key+'. Refresh the job record.')
    launcher.write_text('#!/bin/bash\nset -o pipefail\ncd '+shlex.quote(str(ROOT))+' || exit 1\n'+shlex.join(['env']+[key+'='+value for key,value in env.items()]+command)+' 2>&1 | python3 '+shlex.quote(str(STATE/'consoleSink.py'))+' '+shlex.quote(str(log))+'\nresult=${PIPESTATUS[0]}\nprintf "%s\\n" "$result" > '+shlex.quote(str(exitfile))+'\nexit "$result"\n')
    launcher.chmod(0o700)
    attempts=record.get('attempts') or []
    if not isinstance(attempts,list): attempts=[]
    retained=[]
    for old in attempts:
        if not isinstance(old,dict): continue
        old_file=registered_log_path(old.get('log'))
        started_at=old.get('started_at')
        if isinstance(started_at,(int,float)) and started_at<time.time()-7*86400 and old_file and old_file.is_relative_to(STATE/'logs'):
            for suffix in ['', '.1', '.2', '.3', '.4']:
                candidate=Path(str(old_file)+suffix)
                if not candidate.is_symlink(): candidate.unlink(missing_ok=True)
        else: retained.append(old)
    attempts=retained
    if record.get('log') and not attempts: attempts.append({'id':'legacy','log':record['log']})
    attempts.append({'id':attempt,'started_at':int(time.time()),'log':str(log)})
    record.update(log=str(log),attempts=attempts,attempt_id=attempt)

def resume_job(identifier):
    record=control_record(identifier)
    if live_record(record): raise ValueError('This scraper process is already running.')
    command=validate_resume(record)
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
    attempt=str(time.time_ns());session='dashboard_resume_'+record['id'].replace('-','_')+'_'+attempt
    log=STATE/(record['id']+'.log');exitfile=STATE/(record['id']+'.exit');launcher=STATE/(record['id']+'.sh')
    build_launcher(record,command,launcher,exitfile,attempt)
    exitfile.unlink(missing_ok=True)
    run('tmux','new-session','-d','-s',session,'bash '+shlex.quote(str(launcher)))
    record.update(session=session,resumed_at=int(time.time()),pid=None,start=None);save_record(record)
    deadline=time.monotonic()+3
    while time.monotonic()<deadline:
        found=next(((identity,active) for identity,active in known_processes() if active['command_key']==record['command_key']),None)
        if found:
            record.update(pid=found[0]['pid'],start=found[0]['start']);save_record(record);break
        if exitfile.exists(): break
        time.sleep(.2)
    return {'message':'Resumed the scraper batch with its original command and output files.' if record['shared'] else 'Resumed the scraper with its original input and output.',
            'session':session,'scrapers':[row['scraper'] for row in record['rows']]}

def selected_row(record,scraper):
    row=next((row for row in record['rows'] if row['scraper']==scraper),None)
    if not row: raise ValueError('This scraper does not belong to the selected job.')
    return row

def clear_pause_job(identifier,scraper):
    record=control_record(identifier);row=selected_row(record,scraper)
    output=safe_path(row['output'],'output');files=pause_files(output)
    # Validate every checkpoint before moving anything. Never follow a link.
    for file in files:
        if file.is_symlink() or file.exists() and not file.is_file(): raise ValueError('Invalid scraper pause checkpoint.')
    archive=STATE/'pause-archive';moved=[]
    for file in files:
        if not file.exists(): continue
        archive.mkdir(mode=0o700,parents=True,exist_ok=True)
        destination=archive/(record['id']+'-'+scraper+'-'+str(time.time_ns())+'-'+file.name)
        file.replace(destination);destination.chmod(0o600);moved.append(file.name)
    return {'message':('Removed the saved pause for '+scraper+'.') if moved else 'No saved pause remains for '+scraper+'.',
            'scraper':scraper,'cleared':len(moved),'shared':record['shared']}

def retry_job(identifier,scraper):
    record=control_record(identifier);row=selected_row(record,scraper)
    if output_stats(safe_path(row['output'],'output'))['processed']>=row['total']: raise ValueError('This scraper has completed its input.')
    identity=live_record(record)
    validate_resume(record,ignore_identity=identity,skip_cooldown=True)
    # Confirm checkpoint paths before interrupting a live shared process.
    for file in pause_files(safe_path(row['output'],'output')):
        if file.is_symlink() or file.exists() and not file.is_file(): raise ValueError('Invalid scraper pause checkpoint.')
    if identity: stop_job(identifier)
    cleared=clear_pause_job(record['id'],scraper)
    resumed=resume_job(record['id'])
    return {**resumed,'message':'Removed the pause for '+scraper+' and retried from saved progress.'+(' The shared batch was restarted.' if record['shared'] else ''),
            'retried_scraper':scraper,'cleared':cleared['cleared']}

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
        cooling=pause and iso_timestamp(pause.get('resume_after'))>time.time()
        result.append({**job,'control_id':job['id'],'shared':False,'group_scrapers':[job['scraper']],'can_stop':False,
                       'can_resume':not running and metrics['processed']<job.get('total',0) and not cooling,
                       'can_clear_pause':any(file.exists() for file in pause_files(output)),
                       'can_retry':metrics['processed']<job.get('total',0) and (bool(pause) or state in ('Blocked','Failed')),'pause_reason':pause.get('reason') if pause else None,
                       'running':running,'state':state,'exit_code':exit_code,'resume_after':pause.get('resume_after') if pause else None,**metrics,'failure':failure_details(job,job,{},pause or {},metrics)})
    discovered=discover_jobs()
    tracked_pairs={(j['scraper'],j['input'],j['output']) for j in discovered}
    result=[job for job in result if (job['scraper'],job['input'],job['output']) not in tracked_pairs]+discovered
    processes=process_info()
    memory={}
    for line in Path('/proc/meminfo').read_text().splitlines():
        k,_,v=line.partition(':')
        if k in ('MemTotal','MemAvailable','SwapTotal','SwapFree'): memory[k]=int(v.split()[0])*1024
    return {'checked_at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'jobs':result,'process_count':len(processes),'processes':processes[:100], 'memory':memory, 'sessions':sorted(sessions), 'git':git_state()}

def failure_details(record,row,snapshot,pause,metrics):
    last=metrics.get('last_failure')
    reason=snapshot.get('error') or pause.get('reason')
    exit_code=None
    for file in [STATE/((record.get('legacy_job_id') or record['id'])+'.exit'),safe_path(row['output'],'output').parent/'exit-code.txt']:
        if file.is_file() and not file.is_symlink():
            try: exit_code=int(file.read_text().strip())
            except (OSError,ValueError): pass
            break
    return {'message':reason or (last or {}).get('message'),'timestamp':snapshot.get('failed_at') or (last or {}).get('timestamp'),
            'isbn':(last or {}).get('isbn'),'input_index':snapshot.get('input_index',pause.get('input_index',(last or {}).get('input_index'))),
            'error_code':(last or {}).get('error_code'),'exit_code':exit_code,'signal':snapshot.get('signal'),
            'scope':'shared_batch' if record.get('shared') else 'scraper','source':'snapshot' if snapshot.get('error') else 'pause' if pause.get('reason') else 'result' if last else 'unavailable'}

def registered_log_path(candidate):
    """No caller-supplied paths. Registered project logs only, with symlink checks."""
    if not candidate: return None
    file=Path(candidate)
    if not file.is_absolute(): file=ROOT/file
    if file.suffix not in ('.log','.jsonl'): return None
    if '..' in file.parts or not any(file.resolve().is_relative_to(base.resolve()) for base in (STATE,ROOT/'output',ROOT/'logs')): return None
    for parent in [file,*file.parents]:
        if parent.is_symlink(): return None
    return file if file.is_file() else None

def job_logs(req):
    record=control_record(req.get('job'));name=req.get('scraper')
    row=selected_row(record,name) if record.get('rows') else record
    if not record.get('rows') and name!=record.get('scraper'): raise ValueError('Scraper does not belong to this job.')
    source=req.get('source','auto')
    if source not in ('auto','events','console'): raise ValueError('Unknown log source.')
    output=safe_path(row['output'],'output')
    events=registered_log_path(str(output)+'.events.jsonl')
    attempts=[{'id':a['id'],'started_at':a.get('started_at')} for a in (record.get('attempts') or []) if isinstance(a,dict) and a.get('id') and registered_log_path(a.get('log'))]
    chosen=req.get('attempt','current')
    if chosen!='current':
        attempt=next((a for a in (record.get('attempts') or []) if a.get('id')==chosen),None)
        if not attempt: raise ValueError('Unknown console attempt.')
        console=registered_log_path(attempt.get('log'))
    else: console=registered_log_path(record.get('log'))
    if chosen=='current' and not console and live_record(record):
        try: console=registered_log_path(os.readlink('/proc/'+str(record['pid'])+'/fd/1'))
        except OSError: pass
    console=console or registered_log_path(output.parent/'run.log')
    file=events if source=='events' or source=='auto' and events else console
    if not file:
        return {'available':False,'message':'Historical logs unavailable for this job. Structured events are recorded on future launches.','entries':[],'cursor':None,'mixed':bool(record.get('shared'))}
    stat=file.stat();fingerprint=hashlib.sha256(str(file).encode()).hexdigest()[:16]
    cursor=req.get('cursor');previous={}
    if cursor:
        if not isinstance(cursor,str) or len(cursor)>1024: raise ValueError('Invalid log cursor.')
        try: previous=json.loads(base64.urlsafe_b64decode(cursor+'='*(-len(cursor)%4)))
        except (ValueError,TypeError): raise ValueError('Invalid log cursor.')
        if not isinstance(previous,dict) or not isinstance(previous.get('offset'),int) or previous['offset']<0: raise ValueError('Invalid log cursor.')
    identity=[stat.st_dev,stat.st_ino]
    with file.open('rb') as prefix_file:
        prefix=prefix_file.read(1024)
    prefix_length=previous.get('prefix_length',0)
    prefix_changed=bool(prefix_length and (prefix_length>len(prefix) or hashlib.sha256(prefix[:prefix_length]).hexdigest()!=previous.get('prefix')))
    reset=bool(previous and (previous.get('file')!=fingerprint or previous.get('inode')!=identity or previous['offset']>stat.st_size or prefix_changed))
    start=previous['offset'] if previous and not reset else max(0,stat.st_size-65536)
    entries=[]
    with file.open('rb') as stream:
        stream.seek(start)
        if start and (not previous or reset): stream.readline();start=stream.tell()
        raw=stream.read(65536)
        end=raw.rfind(b'\n')+1
        if end==0 and len(raw)==65536:
            entries=[{'id':str(start),'text':'[Oversized log line skipped; showing next chunk]','level':'warn'}];end=len(raw)
        raw=raw[:end];offset=start
        for line in raw.splitlines(keepends=True):
            text=line.decode('utf8',errors='replace').rstrip('\r\n')[:8192]
            entry={'id':fingerprint+':'+str(stat.st_ino)+':'+str(offset),'text':text,'level':'info'}
            if file==events:
                try:
                    event=json.loads(text)
                    if isinstance(event,dict):
                        for key in ('timestamp','event','message','level','input_index','isbn','attempt_id','error_code','exit_code','signal'):
                            if key in event and isinstance(event[key],(str,int,float,bool,type(None))): entry[key]=event[key]
                except ValueError: pass
            entries.append(entry);offset+=len(line)
    token=base64.urlsafe_b64encode(json.dumps({'file':fingerprint,'inode':identity,'offset':start+end,'prefix_length':len(prefix),'prefix':hashlib.sha256(prefix).hexdigest()}).encode()).decode().rstrip('=')
    return {'available':True,'source':'events' if file==events else 'console','mixed':bool(record.get('shared') and file!=events),'entries':entries[-500:],'cursor':token,'reset':reset,'truncated':len(entries)>500,'has_more':start+end<stat.st_size,'attempts':attempts}

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
    if name in LEGACY: output=default_json_output(name,rel)
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
    job={'id':job_id,'scraper':name,'input':rel,'input_sha256':digest,'total':total,'output':output,'session':session,'started_at':int(time.time())}
    build_launcher(job,command,launcher,exitfile,str(time.time_ns()))
    record=STATE/(job_id+'.json'); record.write_text(json.dumps(job)); record.chmod(0o600)
    try: run('tmux','new-session','-d','-s',session,'bash '+shlex.quote(str(launcher)))
    except Exception: record.unlink(); raise
    return job

def main():
    encoded = sys.argv[1]; req=json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)).decode()); op=req.get('op')
    if op=='logs': result=job_logs(req)
    elif op=='files': result={'items':list_inputs(req.get('folder','input-data'))}
    elif op in ('status','sync','launch','stop','resume','retry','clear-pause'):
        STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
        with (STATE / 'management.lock').open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            if op=='status': result=status()
            elif op=='sync': result=sync(req.get('commit'))
            elif op=='launch': result=launch(req)
            elif op=='stop': result=stop_job(req.get('job'))
            elif op=='resume': result=resume_job(req.get('job'))
            elif op=='retry': result=retry_job(req.get('job'),req.get('scraper'))
            else: result=clear_pause_job(req.get('job'),req.get('scraper'))
    else: raise ValueError('Unknown operation.')
    print(json.dumps({'ok':True,'result':result}))
try: main()
except Exception as e: print(json.dumps({'ok':False,'error':str(e)})); sys.exit(1)

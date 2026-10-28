import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch

source = Path('scripts/vps-status/manager.py').read_text().rsplit('\ntry: main()', 1)[0]
manager = {}
exec(compile(source, 'manager.py', 'exec'), manager)

class ManagerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.root=Path(self.temp.name); self.state=self.root/'state'
        manager['ROOT']=self.root; manager['STATE']=self.state
        (self.root/'input-data').mkdir(); (self.root/'input-data'/'sample.txt').write_text('9781234567890\n')
        (self.root/'scrapers'/'flipkart').mkdir(parents=True); (self.root/'scrapers'/'flipkart'/'flipkart-isbn.js').write_text('// fixture')
    def tearDown(self): self.temp.cleanup()
    def test_paths_confined_and_symlinks_rejected(self):
        with self.assertRaises(ValueError): manager['safe_path']('input-data/../secret','input-data')
        (self.root/'input-data'/'link').symlink_to(self.root/'input-data'/'sample.txt')
        with self.assertRaises(ValueError): manager['safe_path']('input-data/link','input-data')
        self.assertEqual(manager['list_inputs']('input-data'),[{'name':'sample.txt','path':'input-data/sample.txt','type':'file'}])
    def test_launch_rejects_duplicate_and_changed_input(self):
        req={'scraper':'flipkart','input':'input-data/sample.txt','commit':'a'*40}
        fake=lambda *args,**kwargs: ''
        with patch.dict(manager, {'run':fake, 'live_sessions':lambda:set(),'git_state':lambda:{'commit':'a'*40,'dirty':False}}):
            job=manager['launch'](req)
            self.assertEqual(job['total'],1)
            out=self.root/job['output'];out.write_text('{"searched_isbn":"9781234567890"}\n')
            with patch.dict(manager, {'live_sessions':lambda:{job['session']}}):
                with self.assertRaisesRegex(ValueError,'already running'): manager['launch'](req)
            (self.root/'input-data'/'sample.txt').write_text('changed\n')
            with self.assertRaisesRegex(ValueError,'Existing output'): manager['launch'](req)
    def test_sync_refuses_dirty_and_active_scrapers(self):
        commit='a'*40
        with patch.dict(manager, {'git_state':lambda:{'branch':'main','commit':'b'*40,'dirty':True}}):
            with self.assertRaisesRegex(ValueError,'clean'): manager['sync'](commit)
        def fake_run(*args,**kwargs):
            if args[:2]==('git','rev-parse'): return commit
            if args[:2]==('ps','-eo'): return 'node scripts/run-shared-scrapers.js input.txt'
            return ''
        with patch.dict(manager, {'git_state':lambda:{'branch':'main','commit':'b'*40,'dirty':False},'run':fake_run}):
            with self.assertRaisesRegex(ValueError,'running'): manager['sync'](commit)
    def test_discovers_shared_runner_and_saved_progress(self):
        import os
        folder=self.root/'output'/'shared-runs';folder.mkdir(parents=True)
        output=self.root/'output'/'flipkart'/'results.jsonl';output.parent.mkdir(parents=True);output.write_text('{"isbn_matched":true}\n')
        (folder/'test.status.json').write_text(json.dumps({'pid':123,'scrapers':{'flipkart':{'output':str(output),'total':2,'state':'Queued'}}}))
        (self.root/'scripts').mkdir();(self.root/'scripts/run-shared-scrapers.js').write_text('// fixture')
        identity={'pid':123,'start':'456','state':'S','executable':'/usr/bin/node','parent':1}
        spec=manager['process_spec']('/usr/bin/node',str(self.root),['node','scripts/run-shared-scrapers.js','input-data/sample.txt','--headless'])
        with patch.dict(manager, {'known_processes':lambda:[(identity,spec)],'live_record':lambda record:identity if record.get('pid')==123 else None}):
            rows=manager['discover_jobs']()
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['state'],'Queued');self.assertEqual(rows[0]['processed'],1);self.assertEqual(rows[0]['matched'],1)
        self.assertTrue(rows[0]['shared']);self.assertTrue(rows[0]['can_stop']);self.assertFalse(rows[0]['can_resume'])
        with patch.dict(manager, {'known_processes':lambda:[],'live_record':lambda record:None}):
            stopped=manager['discover_jobs']()
        self.assertEqual(stopped[0]['state'],'Stopped');self.assertTrue(stopped[0]['can_resume']);self.assertEqual(rows[0]['control_id'],stopped[0]['control_id'])
    def test_output_ignores_partial_and_detects_failures(self):
        f=self.root/'out';f.write_bytes(b'{"isbn_matched":true}\n{"stock_status":"Blocked"}\n{"title":"Error"}\n{"incomplete"')
        data=manager['output_stats'](f)
        self.assertEqual((data['processed'],data['matched'],data['blocked'],data['errors']),(3,1,1,1))

    def test_only_exact_project_node_scrapers_can_be_controlled(self):
        args=['node','scrapers/flipkart/flipkart-isbn.js','input-data/sample.txt','--output','output/flipkart/results.jsonl','--headless']
        spec=manager['process_spec']('/usr/bin/node',str(self.root),args)
        self.assertEqual(spec['output'],'output/flipkart/results.jsonl')
        self.assertIsNone(manager['process_spec']('/usr/bin/python3',str(self.root),args))
        self.assertIsNone(manager['process_spec']('/usr/bin/node','/tmp',args))
        self.assertIsNone(manager['process_spec']('/usr/bin/node',str(self.root),['node','-e','input-data/sample.txt']))
        self.assertIsNone(manager['process_spec']('/usr/bin/node',str(self.root),args+['--eval','bad']))
        self.assertIsNone(manager['process_spec']('/usr/bin/node',str(self.root),args[:3]+['--output','/etc/native.json']))
        for name,expected in [('walmart','output/walmart/input-data-sample.jsonl'),('abebooks-google','output/abebooks-google/sample/results.jsonl')]:
            folder=self.root/'scrapers'/name;folder.mkdir();(folder/(name+'-isbn.js')).write_text('// fixture')
            parsed=manager['process_spec']('/usr/bin/node',str(self.root),['node','scrapers/'+name+'/'+name+'-isbn.js','input-data/sample.txt'])
            self.assertEqual(parsed['output'],expected)

    def test_pid_reuse_never_signals_native_process(self):
        original={'pid':123,'start':'456','executable':'/usr/bin/node'};calls=[]
        with patch.dict(manager, {'process_identity':lambda pid:{**original,'start':'789','executable':'/usr/bin/native'}}),patch.object(manager['os'],'kill',side_effect=lambda *args:calls.append(args)):
            manager['signal_identity'](original,manager['signal'].SIGINT)
        self.assertEqual(calls,[])

    def test_stop_shared_process_preserves_outputs_and_limits_signals_to_owned_tree(self):
        identity={'pid':123,'start':'456','state':'S','executable':'/usr/bin/node'}
        child={'pid':124,'start':'457','state':'S','executable':'/root/.cache/ms-playwright/chromium/chrome'}
        record={'id':'process-'+'a'*20,'shared':True,'rows':[{'scraper':'flipkart'}]};live=[True];calls=[];saved=[]
        def signal_one(item,signum):
            calls.append((item['pid'],signum))
            if item['pid']==123: live[0]=False
        with patch.dict(manager,{'control_record':lambda ident:record,'live_record':lambda item:identity if live[0] else None,'browser_children':lambda item:[child],'signal_identity':signal_one,'save_record':lambda value:saved.append(value)}):
            result=manager['stop_job'](record['id'])
        self.assertIn('batch',result['message']);self.assertEqual(calls[0],(123,manager['signal'].SIGINT));self.assertEqual({pid for pid,_ in calls},{123,124});self.assertEqual(len(saved),1)

    def test_resume_uses_original_output_and_refuses_changed_input_cooldown_and_duplicate(self):
        args=['node','scrapers/flipkart/flipkart-isbn.js','input-data/sample.txt','--headless','--output','output/original/results.jsonl']
        spec=manager['process_spec']('/usr/bin/node',str(self.root),args)
        output=self.root/spec['output'];output.parent.mkdir(parents=True)
        record={'kind':'scraper-process','id':'process-'+'b'*20,**spec,'rows':[{key:spec[key] for key in ('scraper','input','output','total')}],'pid':None,'start':None}
        calls=[];started=[False];identity={'pid':333,'start':'999'}
        def fake_run(*args,**kwargs): calls.append(args);started[0]=True;return ''
        with patch.dict(manager,{'control_record':lambda ident:record,'live_record':lambda item:None,'known_processes':lambda:[(identity,spec)] if started[0] else [],'run':fake_run,'save_record':lambda value:None}):
            result=manager['resume_job'](record['id'])
        self.assertIn('original input and output',result['message']);self.assertEqual(calls[0][:2],('tmux','new-session'))
        launcher=(self.state/(record['id']+'.sh')).read_text();self.assertIn('output/original/results.jsonl',launcher)
        (self.root/'input-data/sample.txt').write_text('changed\n')
        with patch.dict(manager,{'control_record':lambda ident:record,'live_record':lambda item:None}):
            with self.assertRaisesRegex(ValueError,'Input changed'):manager['resume_job'](record['id'])
        (self.root/'input-data/sample.txt').write_text('9781234567890\n')
        with patch.dict(manager,{'control_record':lambda ident:record,'live_record':lambda item:None,'known_processes':lambda:[(identity,spec)]}):
            with self.assertRaisesRegex(ValueError,'already running'):manager['resume_job'](record['id'])
        Path(str(output)+'.pause.json').write_text(json.dumps({'resume_after':'2099-01-01T00:00:00Z'}))
        with patch.dict(manager,{'control_record':lambda ident:record,'live_record':lambda item:None}):
            with self.assertRaisesRegex(ValueError,'cooldown'):manager['resume_job'](record['id'])

    def test_arbitrary_job_id_cannot_control_a_native_process(self):
        with patch.dict(manager,{'known_processes':lambda:[]}):
            with self.assertRaisesRegex(ValueError,'no longer exists'):manager['stop_job']('123')
            with self.assertRaisesRegex(ValueError,'Invalid scraper'):manager['resume_job']('../../native')

    def test_remove_pause_archives_only_selected_scraper_without_stopping_processes(self):
        selected=self.root/'output/flipkart/results.jsonl';selected.parent.mkdir(parents=True);selected.write_text('{"isbn_matched":true}\n')
        other=self.root/'output/atlantic/results.jsonl';other.parent.mkdir(parents=True)
        pause=Path(str(selected)+'.shared-pause.json');pause.write_text('{"resume_after":"2099-01-01T00:00:00Z"}')
        otherpause=Path(str(other)+'.shared-pause.json');otherpause.write_text('{"reason":"keep this"}')
        record={'id':'process-'+'a'*20,'shared':True,'rows':[{'scraper':'flipkart','output':str(selected.relative_to(self.root))},{'scraper':'atlanticbooks','output':str(other.relative_to(self.root))}]}
        with patch.dict(manager,{'control_record':lambda ident:record}),patch.object(manager['os'],'kill',side_effect=AssertionError('Remove pause must not signal a process')):
            result=manager['clear_pause_job'](record['id'],'flipkart')
            with self.assertRaisesRegex(ValueError,'does not belong'):manager['clear_pause_job'](record['id'],'native')
        self.assertEqual(result['cleared'],1);self.assertFalse(pause.exists());self.assertTrue(otherpause.exists());self.assertEqual(selected.read_text(),'{"isbn_matched":true}\n')
        archives=list((self.state/'pause-archive').iterdir());self.assertEqual(len(archives),1);self.assertIn('2099',archives[0].read_text())

    def test_pause_symlink_is_rejected_without_touching_target(self):
        output=self.root/'output/results.jsonl';output.parent.mkdir()
        target=self.root/'native.json';target.write_text('native data')
        pause=Path(str(output)+'.pause.json');pause.symlink_to(target)
        record={'id':'process-'+'a'*20,'shared':False,'rows':[{'scraper':'flipkart','output':'output/results.jsonl'}]}
        with patch.dict(manager,{'control_record':lambda ident:record}):
            with self.assertRaisesRegex(ValueError,'Invalid scraper pause'):manager['clear_pause_job'](record['id'],'flipkart')
        self.assertEqual(target.read_text(),'native data');self.assertTrue(pause.is_symlink())

    def test_retry_now_bypasses_saved_cooldown_and_keeps_original_output(self):
        args=['node','scrapers/flipkart/flipkart-isbn.js','input-data/sample.txt','--headless','--output','output/original/results.jsonl']
        spec=manager['process_spec']('/usr/bin/node',str(self.root),args);output=self.root/spec['output'];output.parent.mkdir(parents=True)
        pause=Path(str(output)+'.pause.json');pause.write_text('{"resume_after":"2099-01-01T00:00:00Z"}')
        record={'kind':'scraper-process','id':'process-'+'c'*20,**spec,'rows':[{key:spec[key] for key in ('scraper','input','output','total')}],'pid':None,'start':None}
        started=[False];calls=[];identity={'pid':444,'start':'999'}
        def fake_run(*args,**kwargs):calls.append(args);started[0]=True;return ''
        with patch.dict(manager,{'control_record':lambda ident:record,'live_record':lambda item:None,'known_processes':lambda:[(identity,spec)] if started[0] else [],'run':fake_run,'save_record':lambda value:None}):
            result=manager['retry_job'](record['id'],'flipkart')
        self.assertEqual(result['cleared'],1);self.assertFalse(pause.exists());self.assertEqual(len(calls),1)
        self.assertIn('output/original/results.jsonl',(self.state/(record['id']+'.sh')).read_text())

    def test_shared_retry_validates_before_stop_then_clears_only_selected_pause(self):
        output=self.root/'output/flipkart/results.jsonl';output.parent.mkdir(parents=True)
        pause=Path(str(output)+'.shared-pause.json');pause.write_text('{}')
        record={'id':'process-'+'d'*20,'shared':True,'rows':[{'scraper':'flipkart','output':'output/flipkart/results.jsonl','total':2}]}
        identity={'pid':123,'start':'456'};events=[]
        def validate(record,**options):events.append('validate');self.assertTrue(options['skip_cooldown']);self.assertEqual(options['ignore_identity'],identity)
        def stop(ident):events.append('stop');self.assertTrue(pause.exists())
        def resume(ident):events.append('resume');self.assertFalse(pause.exists());return {'session':'fixture'}
        with patch.dict(manager,{'control_record':lambda ident:record,'live_record':lambda record:identity,'validate_resume':validate,'stop_job':stop,'resume_job':resume}):
            result=manager['retry_job'](record['id'],'flipkart')
        self.assertEqual(events,['validate','stop','resume']);self.assertIn('shared batch',result['message'])

    def test_retry_preflight_failure_preserves_pause_and_running_batch(self):
        output=self.root/'output/results.jsonl';output.parent.mkdir();pause=Path(str(output)+'.shared-pause.json');pause.write_text('{}')
        record={'id':'process-'+'d'*20,'shared':True,'rows':[{'scraper':'flipkart','output':'output/results.jsonl','total':2}]}
        def fail(*args,**kwargs):raise ValueError('Input changed')
        with patch.dict(manager,{'control_record':lambda ident:record,'live_record':lambda record:None,'validate_resume':fail,'stop_job':lambda ident:self.fail('Must not stop on invalid input')}):
            with self.assertRaisesRegex(ValueError,'Input changed'):manager['retry_job'](record['id'],'flipkart')
        self.assertTrue(pause.exists())

if __name__=='__main__': unittest.main()

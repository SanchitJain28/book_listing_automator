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
        processes='123 node scripts/run-shared-scrapers.js input-data/sample.txt --headless'
        with patch.dict(manager, {'run':lambda *args,**kwargs:processes}):
            rows=manager['discover_jobs']()
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['state'],'Queued');self.assertEqual(rows[0]['processed'],1);self.assertEqual(rows[0]['matched'],1)
    def test_output_ignores_partial_and_detects_failures(self):
        f=self.root/'out';f.write_bytes(b'{"isbn_matched":true}\n{"stock_status":"Blocked"}\n{"title":"Error"}\n{"incomplete"')
        data=manager['output_stats'](f)
        self.assertEqual((data['processed'],data['matched'],data['blocked'],data['errors']),(3,1,1,1))

if __name__=='__main__': unittest.main()

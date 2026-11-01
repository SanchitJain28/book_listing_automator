"""Bounded raw stdout/stderr sink for dashboard-launched commands."""
import os, sys
from pathlib import Path
file=Path(sys.argv[1]);file.parent.mkdir(parents=True,exist_ok=True)
limit=10*1024*1024;keep=4
while True:
    data=os.read(0,65536)
    if not data: break
    if file.is_symlink(): raise RuntimeError('Refusing linked console log')
    if file.exists() and file.stat().st_size>=limit:
        Path(str(file)+'.'+str(keep)).unlink(missing_ok=True)
        for i in range(keep-1,0,-1):
            old=Path(str(file)+'.'+str(i))
            if old.exists(): old.replace(str(file)+'.'+str(i+1))
        file.replace(str(file)+'.1')
    fd=os.open(file,os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
    try: os.write(fd,data)
    finally: os.close(fd)

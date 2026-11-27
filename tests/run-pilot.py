"""Reproduce all NEXT LEVEL pilot checks on an empty database, with no external services."""
import ast
import subprocess
import sys
import tempfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
screens=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/"review"
screens.mkdir(exist_ok=True,parents=True)
def run(script,*args):
    subprocess.run([sys.executable,str(root/script),*map(str,args)],cwd=root,check=True)

for script in ("tests/check-rules.py","tests/check-choice.py","tests/check-season.py","tests/check-push.py","analysis/check-metrics.py"):
    run(script)
with tempfile.TemporaryDirectory() as tmp:
    db=Path(tmp)/"test.sqlite"
    server=subprocess.Popen([sys.executable,"-u",str(root/"web/server.py"),"--port","0","--db",str(db)],cwd=root,stdout=subprocess.PIPE,text=True)
    try:
        host,port=ast.literal_eval(server.stdout.readline().split("listening on ")[1])
        base=f"http://{host}:{port}/"
        run("tests/next_exchange.py",base,screens)
        for engine in ("chromium","webkit"):
            out=screens/engine
            out.mkdir(exist_ok=True)
            run("tests/next_diaries.py",base,out,engine)
        run("tests/next_backup.py",db)
    finally:
        server.terminate()
        server.wait(timeout=10)
print("PASS complete NEXT LEVEL pilot suite")


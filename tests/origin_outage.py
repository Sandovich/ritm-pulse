"""A dedicated local origin that can disappear without changing browser networking."""
import ast
import subprocess
import sys
from pathlib import Path

class Origin:
    def __init__(self,db):
        self.db=db
        self.port=0
        self.process=None
    def start(self):
        self.process=subprocess.Popen([sys.executable,'-u',str(Path(__file__).resolve().parents[1]/'web/server.py'),'--port',str(self.port),'--db',str(self.db)],stdout=subprocess.PIPE,text=True)
        host,self.port=ast.literal_eval(self.process.stdout.readline().split('listening on ')[1])
        return f'http://{host}:{self.port}/'
    def stop(self):
        if self.process:
            self.process.terminate()
            self.process.wait(timeout=10)
            self.process.stdout.close()
            self.process=None


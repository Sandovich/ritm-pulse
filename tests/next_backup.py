"""Restore a fresh temporary copy of the pilot DB and compare every table."""
from contextlib import closing
import sqlite3
import sys
import tempfile
from pathlib import Path

source=Path(sys.argv[1]).resolve(strict=True)
with tempfile.TemporaryDirectory() as temp:
    restored=Path(temp)/'restored.sqlite'
    with closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)) as live, closing(sqlite3.connect(restored)) as backup:
        live.execute('BEGIN')
        live.backup(backup)
        assert backup.execute('PRAGMA integrity_check').fetchone()==('ok',)
        assert not backup.execute('PRAGMA foreign_key_check').fetchall()
        tables=[r[0] for r in live.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        for name in tables:
            quoted='"'+name.replace('"','""')+'"'
            assert live.execute('SELECT * FROM '+quoted).fetchall()==backup.execute('SELECT * FROM '+quoted).fetchall(),name
        print('PASS SQLite backup, restore, integrity, foreign keys and contents of',len(tables),'tables.')

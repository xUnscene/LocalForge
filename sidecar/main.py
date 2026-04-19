import os
import socket
import sys

import uvicorn

from app import create_app


def find_free_port() -> int:
    # NOTE: There is a small race between closing this probe socket and uvicorn
    # binding the returned port. Acceptable for local-only use on Windows MVP.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]


if __name__ == '__main__':
    engine_dir = os.path.join(os.environ.get('APPDATA', ''), 'LocalForge', 'engine')
    port = find_free_port()
    print(f'PORT={port}', flush=True)
    sys.stdout.flush()
    uvicorn.run(
        create_app(engine_dir),
        host='127.0.0.1',
        port=port,
        log_level='warning',
    )

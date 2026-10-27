"""Root-only installation helper. Input is private JSON via SSH stdin, never argv."""
import json, os, re, sys, tempfile
from pathlib import Path

def configure():
    root = Path('/opt/central-cop-escalonamentos')
    target = root / '.env'
    if os.geteuid() != 0 or Path.cwd().resolve() != root or target.is_symlink() or not target.is_file():
        raise ValueError('Unexpected backend configuration target')
    raw = sys.stdin.read(4097)
    if len(raw) > 4096:
        raise ValueError('Invalid input')
    payload = json.loads(raw)
    if payload.get('username') != 'nlsoarez@gmail.com' or not isinstance(payload.get('password'), str) or not re.fullmatch(r'[A-Za-z0-9]{16}', payload['password']):
        raise ValueError('Invalid Gmail configuration')
    settings = {'COP_GMAIL_APP_PASSWORD': payload['password'], 'COP_FIRST_ACCESS_ENABLED': 'false'}
    lines = target.read_text().splitlines()
    for key, value in settings.items():
        matches = [i for i, line in enumerate(lines) if line.startswith(key + '=')]
        if len(matches) > 1:
            raise ValueError('Duplicate configuration key')
        if matches:
            lines[matches[0]] = key + '=' + value
        else:
            lines.append(key + '=' + value)
    descriptor, temporary = tempfile.mkstemp(prefix='.gmail-config-', dir=root)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, 'w') as stream:
            stream.write('\n'.join(lines) + '\n')
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('Private Gmail configuration installed; first access remains disabled.')

if __name__ == '__main__':
    try:
        configure()
    except Exception:
        print('Private Gmail configuration failed; no secrets displayed.', file=sys.stderr)
        sys.exit(1)

#!/usr/bin/python3
import datetime
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import stat
import subprocess

BASE = Path('/mnt/HC_Volume_107348367/psm/operations/pm')
REQUESTS = BASE / 'requests'
RESULTS = BASE / 'results'
ALLOWED = {'restart-php', 'restart-web', 'restart-expo'}
ID = re.compile(r'^[a-f0-9]{24}$')


def read_request(file, job_id):
    fd = os.open(str(file), os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > 2048 or info.st_uid != pwd.getpwnam('psm').pw_uid:
            raise ValueError('invalid_file')
        data = json.load(stream)
    if not isinstance(data, dict) or data.get('version') != 1 or data.get('id') != job_id or data.get('project') != 'rental' or data.get('approved') is not True or data.get('action') not in ALLOWED:
        raise ValueError('invalid_request')
    created = datetime.datetime.strptime(data['createdAt'], '%Y-%m-%dT%H:%M:%S.%fZ')
    age = (datetime.datetime.utcnow() - created).total_seconds()
    if not -30 <= age <= 180:
        raise ValueError('expired_request')
    return data


def result(job_id, data):
    temporary = RESULTS / ('.' + job_id + '-' + secrets.token_hex(6))
    fd = os.open(str(temporary), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o640)
    os.fchown(fd, 0, pwd.getpwnam('psm').pw_gid)
    with os.fdopen(fd, 'w') as output:
        json.dump({'id': job_id, 'completedAt': datetime.datetime.utcnow().isoformat() + 'Z', **data}, output)
    os.replace(str(temporary), str(RESULTS / (job_id + '.json')))


def main():
    if os.getuid() != 0:
        raise SystemExit('Root project worker required.')
    pending = [file for file in sorted(REQUESTS.glob('*.json'))
               if ID.fullmatch(file.stem) and not (RESULTS / (file.stem + '.json')).exists()]
    for file in pending[:20]:
        job_id = file.stem
        if not ID.fullmatch(job_id) or (RESULTS / (job_id + '.json')).exists():
            continue
        try:
            request = read_request(file, job_id)
            completed = subprocess.run(['/usr/local/sbin/psm-rental-control', request['action']],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=55)
            if completed.returncode:
                result(job_id, {'status': 'failed', 'error': 'service_restart_failed'})
            else:
                result(job_id, {'status': 'completed', 'action': request['action']})
        except (ValueError, KeyError, OSError):
            result(job_id, {'status': 'rejected', 'error': 'invalid_request'})
        except Exception:
            result(job_id, {'status': 'failed', 'error': 'project_control_failed'})


if __name__ == '__main__':
    main()

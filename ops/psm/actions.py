#!/usr/bin/python3
"""Forced SSH command for the repository's deployment key."""
import os
import re
import shlex

command = shlex.split(os.environ.get('SSH_ORIGINAL_COMMAND', ''))
if command == ['check']:
    print('psm-rental-ready')
elif len(command) == 2 and command[0] == 'deploy' and re.fullmatch(r'[0-9a-f]{40}', command[1]):
    os.execv('/usr/bin/sudo', ['sudo', '-n', '/usr/local/sbin/psm-rental-deploy', command[1]])
else:
    raise SystemExit('Only check and deployment of a full commit SHA are supported.')

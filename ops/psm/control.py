#!/usr/bin/python3
"""Fixed project service allowlist for PSM and the project deployment account."""
import json
import os
import subprocess
import sys

SERVICES = {'php': 'psm-rental-php', 'web': 'psm-rental-web', 'expo': 'rental-expo', 'database': 'psm-rental-db'}
ACTIONS = {'restart-php': 'php', 'restart-web': 'web', 'restart-expo': 'expo'}


def main():
    if os.getuid() != 0 or len(sys.argv) != 2:
        raise SystemExit('Use the installed privileged project controller.')
    action = sys.argv[1]
    if action == 'status':
        result = {}
        for key, service in SERVICES.items():
            check = subprocess.run(['systemctl', 'is-active', service], stdout=subprocess.PIPE,
                                   universal_newlines=True)
            result[key] = check.stdout.strip()
        print(json.dumps(result))
    elif action in ACTIONS:
        subprocess.check_call(['systemctl', 'restart', SERVICES[ACTIONS[action]]])
        print(json.dumps({'ok': True, 'action': action}))
    else:
        raise SystemExit('Unsupported project action.')


if __name__ == '__main__':
    main()

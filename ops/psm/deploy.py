#!/usr/bin/python3
"""Root-installed deployment entrypoint; never run a root helper from the app checkout."""
import datetime
import fcntl
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path('/mnt/HC_Volume_107348367/psm/pm/rental')
SOURCE = ROOT / 'source'
USER = 'psm-rental'
PHP = '/usr/local/sbin/psm-rental-php'


def run(args, **kwargs):
    return subprocess.check_output(args, universal_newlines=True, **kwargs)


def account(args, **kwargs):
    return run(['/usr/sbin/runuser', '-u', USER, '--', '/usr/bin/env',
                'HOME=' + str(ROOT / 'home'), 'PATH=/usr/bin:/bin'] + args, **kwargs)


def fetch_from_github(previous):
    # Root's existing GitHub connection remains outside the application account.
    # The application receives only Git objects, never a token or credential helper.
    mirror = ROOT / 'config/git-mirror'
    env = dict(os.environ, HOME='/root', XDG_CONFIG_HOME='/root/.config', PATH='/usr/bin:/bin')
    for key in ['GIT_CONFIG_COUNT', 'GIT_SSH_COMMAND', 'GIT_ASKPASS', 'GH_TOKEN', 'GITHUB_TOKEN']:
        env.pop(key, None)
    if not mirror.exists():
        run(['git', 'init', '--bare', str(mirror)], env=env)
        os.chmod(str(mirror), 0o700)
        run(['git', '--git-dir=' + str(mirror), 'remote', 'add', 'origin', 'https://github.com/Bafageeh/rental.git'], env=env)
    git = ['git', '--git-dir=' + str(mirror), '-c', 'credential.helper=',
           '-c', 'credential.helper=!/usr/bin/gh auth git-credential']
    run(git + ['fetch', '--quiet', 'origin', 'refs/heads/main:refs/heads/main'], env=env)
    latest = run(git + ['rev-parse', 'refs/heads/main'], env=env).strip()
    if previous != latest:
        run(git + ['merge-base', '--is-ancestor', previous, latest], env=env)
        staging = ROOT / 'config/deploy-staging'
        staging.mkdir(mode=0o711, exist_ok=True)
        directory = Path(tempfile.mkdtemp(prefix='bundle-', dir=str(staging)))
        import pwd
        os.chown(str(directory), 0, pwd.getpwnam(USER).pw_gid)
        os.chmod(str(directory), 0o750)
        bundle = directory / 'source.bundle'
        try:
            run(git + ['bundle', 'create', str(bundle), previous + '..refs/heads/main'], env=env)
            os.chown(str(bundle), 0, pwd.getpwnam(USER).pw_gid)
            os.chmod(str(bundle), 0o640)
            account(['git', '-C', str(SOURCE), 'fetch', '--quiet', str(bundle),
                     'refs/heads/main:refs/remotes/origin/main'])
        finally:
            shutil.rmtree(str(directory))
    return latest


def main():
    if os.getuid() != 0 or len(sys.argv) != 2 or not re.fullmatch(r'[0-9a-f]{40}', sys.argv[1]):
        raise SystemExit('Expected one full Git commit SHA, via the installed privileged entrypoint.')
    requested = sys.argv[1]
    with open('/run/lock/psm-rental-deploy.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        previous = account(['git', '-C', str(SOURCE), 'rev-parse', 'HEAD']).strip()
        latest = fetch_from_github(previous)
        if requested != latest:
            print('Superseded deployment skipped; main has advanced.')
            return
        changes = account(['git', '-C', str(SOURCE), 'diff', '--name-only', previous, requested]).splitlines()
        dirty = set(account(['git', '-C', str(SOURCE), 'diff', '--name-only', 'HEAD']).splitlines())
        dirty.update(account(['git', '-C', str(SOURCE), 'ls-files', '--others', '--exclude-standard']).splitlines())
        overlap = sorted(dirty.intersection(changes))
        if overlap:
            raise RuntimeError('Production edits overlap this deployment; preserved without changes: ' + ', '.join(overlap))
        stamp = datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
        backup = ROOT / 'backups' / ('deploy-' + stamp + '-' + requested[:10])
        backup.mkdir(mode=0o700)
        patch = account(['git', '-C', str(SOURCE), 'diff', 'HEAD'])
        (backup / 'working-changes.patch').write_text(patch)
        os.chmod(str(backup / 'working-changes.patch'), 0o600)
        # No changed path overlaps a local edit; unrelated production edits stay in place.
        account(['git', '-C', str(SOURCE), 'merge', '--ff-only', requested])
        unresolved = account(['git', '-C', str(SOURCE), 'diff', '--name-only', '--diff-filter=U'])
        if unresolved.strip():
            raise RuntimeError('Production edits conflict with this commit; resolve before deployment.')
        if any(p.endswith(('composer.json', 'composer.lock')) for p in changes):
            print(run([PHP, '/usr/local/bin/composer', 'install', '--no-dev', '--prefer-dist',
                       '--optimize-autoloader', '--no-interaction']))
        if any(p.startswith('my-rentals-api/database/migrations/') for p in changes):
            with open(str(backup / 'database.sql'), 'w') as output:
                os.chmod(str(backup / 'database.sql'), 0o600)
                subprocess.check_call(['mariadb-dump', '--no-defaults', '--protocol=socket',
                    '--socket=/run/psm-rental-db/mysql.sock', '-uroot', '--single-transaction',
                    '--routines', '--events', '--triggers', 'pmsa_rentals_db'], stdout=output)
            print(run([PHP, 'artisan', 'migrate', '--force']))
        for command in ['config:clear', 'route:clear', 'view:clear']:
            print(run([PHP, 'artisan', command]))
        mobile_changes = any(p.startswith(('my-rentals-mobile/src/', 'my-rentals-mobile/assets/'))
                             or p in ('my-rentals-mobile/package.json', 'my-rentals-mobile/package-lock.json')
                             for p in changes)
        if mobile_changes:
            subprocess.check_call(['systemctl', 'stop', 'rental-expo'])
            try:
                account(['npm', 'ci', '--no-audit', '--no-fund'], cwd=str(SOURCE / 'my-rentals-mobile'))
            finally:
                subprocess.check_call(['systemctl', 'start', 'rental-expo'])
        subprocess.check_call(['systemctl', 'restart', 'psm-rental-php'])
        subprocess.check_call(['systemctl', 'reload', 'psm-rental-web'])
        print(run(['curl', '--fail', '--silent', '--show-error', '--retry', '5', '--retry-delay', '1',
                   '--max-time', '15', 'http://127.0.0.1:13961/up']))
        print('PSM Rental deployed ' + requested)


if __name__ == '__main__':
    main()

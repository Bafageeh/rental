# Rental on PSM

The project lives at `/mnt/HC_Volume_107348367/psm/pm/rental`.
The source repository is in `source`; runtime configuration, data, uploads,
private backups, certificates, temporary files, and caches remain with the project.

Production runs as the Linux account `psm-rental`, with independent PHP 8.4,
Nginx, MariaDB, an Expo service on port 8090, and a systemd scheduler.
Public traffic uses PSM's standalone ingress on `2.29.21.85`.

The sole automatic deployment workflow uses the `PSM_RENTAL_SSH_*` secrets.
The SSH key is restricted to deployment of a complete commit SHA; it cannot open
a shell. Installed root-owned helpers live outside the writable application checkout.
Deployment preserves local production edits, stops on conflicts, and does not
reset or delete untracked production files. It does not build an APK.

The helper scripts in this directory are reviewed installation sources. Updating
them in Git does not overwrite privileged installed helpers automatically.

Legacy Apache proxy configuration is only a transition path for DNS caches.
Public independence requires `rental.pm.sa` and `rentals-api.pm.sa` to resolve
to the PSM address. The PSM dashboard can use the same ingress at `panel.pm.sa`.

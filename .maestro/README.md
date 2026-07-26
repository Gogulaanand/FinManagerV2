# Phase 9 mobile E2E

These flows target the Expo development build (`com.finmanager.app`) and use visible, user-facing
labels. They deliberately keep credentials outside YAML.

Run after seeding the shared E2E account:

```sh
maestro test .maestro \
  -e APP_ID=com.finmanager.app \
  -e E2E_USER_EMAIL="$E2E_USER_EMAIL" \
  -e E2E_USER_PASSWORD="$E2E_USER_PASSWORD"
```

For Expo Go, pass its installed app id as `APP_ID`, start Metro, launch the project once, then run
the flows. The native offline-relaunch flow is added in Phase 9c because Expo Go's SQL.js database
is intentionally in-memory.

Required evidence for a run: device/OS, app build or commit, seed timestamp, Maestro result bundle,
and whether the created expense synced to the web fixture account.

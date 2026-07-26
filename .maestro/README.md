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
the critical flows. Expo Go's SQL.js database is intentionally in-memory and cannot run the native
persistence proof.

After installing an Android development build, run the SQLCipher/OP-SQLite relaunch scenario
separately:

```sh
maestro test .maestro/native-offline-relaunch.yaml \
  -e APP_ID=com.finmanager.app \
  -e E2E_USER_EMAIL="$E2E_USER_EMAIL" \
  -e E2E_USER_PASSWORD="$E2E_USER_PASSWORD"
```

The flow signs in online, enables airplane mode, writes an expense, kills and relaunches the
process without clearing state, proves the row survived, and then reconnects. Afterward verify that
the same row appears on web; Maestro cannot inspect the separate web client in this native flow.

Required evidence for a run: device/OS, app build or commit, seed timestamp, Maestro result bundle,
and whether the created expense synced to the web fixture account.

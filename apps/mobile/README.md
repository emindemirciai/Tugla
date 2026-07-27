# Pulse mobile shell

The mobile app wraps the production web client with Capacitor. Native platform directories are
generated locally because they contain machine-specific signing state.

```bash
pnpm --filter @pulse/mobile add:android
pnpm --filter @pulse/mobile add:ios
pnpm --filter @pulse/mobile sync
```

Set `MOBILE_APP_ID` before generating native projects. Real Google Play, Apple Developer,
Sign in with Apple, AdMob and in-app-purchase identifiers remain empty until those external
accounts exist.

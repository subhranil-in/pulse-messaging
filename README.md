# Pulse v8.3 BETA — Password Reset + Update System

New:
- Forgot password button on sign-in.
- Firebase password-reset email flow.
- Automatic version check after Pulse opens.
- iOS-style update popup when version.json contains a newer version.
- Settings > Check for updates.
- Update now refreshes the service worker, clears old Pulse caches and reloads.

How future update alerts work:
Each release has PULSE_VERSION in app.js and a version in version.json. Publish a newer build with a higher version.json version. Older Pulse clients fetch version.json with no-store and show the update popup.

Service-worker cache: v16.

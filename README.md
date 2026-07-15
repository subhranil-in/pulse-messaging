# Pulse v8.4.3 BETA — Black Screen Fix

Fixes the black screen introduced by the startup boot cover.

Changes:
- Removed the full-screen bootCover overlay completely.
- Login view is hidden in HTML by default, so it cannot flash while Firebase restores the session.
- Firebase auth routing reveals only the correct screen.
- Added startup error recovery so an auth/profile startup error cannot leave an invisible overlay blocking Pulse.
- Previous chat restore logic remains.
- Update popup/progress system remains.
- Version 8.4.3; service-worker cache v20.

No Firebase rules or Supabase SQL changes are required.

# Pulse v8.2 BETA — Immediate Download Fix

Fixes the recipient needing to close and reopen Pulse before the received file is saved through the browser download flow.

New flow:
1. Download encrypted file from Supabase.
2. Decrypt locally.
3. Verify SHA-256.
4. Save to Pulse IndexedDB.
5. Immediately trigger the browser/device download for the original filename.
6. Delete the temporary Supabase object.
7. Keep the IndexedDB copy available as Open / Save to device.

Both sender and recipient should update to this build. Service-worker cache version is v15.

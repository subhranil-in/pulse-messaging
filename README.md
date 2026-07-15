# Pulse v8.1 BETA — File Card Fix

Fixes the recipient seeing only "Shared a file".

Changes:
- File messages no longer display the generic text as the main message body.
- When filePath metadata exists, Pulse renders the exact file card with filename, size and Download securely.
- Old/malformed file messages without file metadata show a clear cached-build warning.
- Service-worker cache bumped to v14.

Important:
Both sender and recipient must update to this build. Files already sent from a stale/older cached build without file metadata cannot be reconstructed; send those files again after updating.

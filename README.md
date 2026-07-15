# Pulse v8.4.2 BETA — Update Flow Fix

Fixes:
- The same automatic update popup is shown only once per available version.
- Tapping Later marks that version as seen, so automatic checks do not keep showing the same popup.
- Manual Settings > Check for updates can still show an available update again.
- Tapping Update now shows a real staged progress UI while Pulse refreshes the service worker, clears old Pulse caches, requests current core app files, and prepares a reload.
- Update failures no longer force a reload; Pulse shows an error and a Try again button.
- Current version 8.4.2; service-worker cache v19.

Important:
Browser/PWA updates do not expose exact byte-download progress for all cached app resources. The percentage is staged progress tied to completed update steps, not fake network byte progress.

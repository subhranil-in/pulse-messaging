# Pulse v8.4.1 BETA — Clean Startup + Chat Restore

Changes:
- Removed the animated splash screen.
- Added a plain black boot cover only while Firebase Authentication restores the session.
- The login page is not revealed before Firebase finishes checking the signed-in user.
- Previous Firestore chats are restored after updating.
- A one-time v8.4.1 migration clears the local deletedChats hiding list so older chats can return from Firestore.
- Existing pinned, archived, muted, blocked, starred and other preferences remain.
- Version 8.4.1; service-worker cache v18.

No Supabase SQL or Firestore rule change is required.

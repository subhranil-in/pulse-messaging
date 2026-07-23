# Pulse v8 Supabase Edition — Next Steps

Your Supabase Project URL and publishable key are already configured in app.js.

1. Confirm Authentication > Third-Party Auth > Firebase Auth is connected to Firebase project `pulse-messaging-6d6ca`.
2. Confirm Storage contains a PRIVATE bucket named exactly `pulse-temp-files`.
3. Open Supabase > SQL Editor > New query.
4. Open `supabase-storage-policies.sql`, copy all its SQL, paste it into the SQL Editor, and click Run.
5. Replace your current Pulse GitHub Pages files with this ZIP's main files.
6. In Firebase Console > Firestore Database > Rules, publish the included `firestore.rules`.
7. Commit GitHub changes and wait for Pages.
8. Test in Incognito with two verified Pulse accounts.

Sender: Chat > + > Photo / Video or Document > choose a file under 25 MB.
Recipient: tap Download securely. Pulse downloads encrypted bytes, decrypts and verifies SHA-256, saves the file in IndexedDB, then deletes the Supabase Storage copy.

BETA limitation: the file message contains a 24-hour expiry timestamp, but guaranteed automatic deletion of undelivered files after 24 hours still requires a scheduled server-side cleanup job. Successful recipient delivery deletes the Supabase object immediately.

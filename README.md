# Pulse v8 BETA — Supabase Edition

Firebase Authentication + Supabase Third-Party Auth + private Supabase Storage temporary file delivery.

Files are AES-GCM encrypted before upload. After recipient download, decryption, SHA-256 verification and local IndexedDB save, Pulse deletes the Supabase object.

Read SETUP-SUPABASE.md and run supabase-storage-policies.sql.

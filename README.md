# Pulse v8.4.5 BETA — Phone Search Hard Fix

The earlier fix still depended on several exact Firestore phone queries before its fallback. v8.4.5 now reads the allowed Pulse user profiles and compares normalized phone digits directly in the app.

It matches:
+91 9876543210
+919876543210
919876543210
09876543210
9876543210

The search now also gives a specific message if Firestore profile reads are denied.

Important: publish the included firestore.rules if Pulse says it cannot read user profiles.

Version 8.4.5; service-worker cache v22.

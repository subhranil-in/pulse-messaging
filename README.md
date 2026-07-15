# Pulse v8.5.4 BETA — Firebase Session Splash

Adds a clean, non-animated Pulse splash screen only while Firebase Authentication restores the user's login session.

Flow:
1. Pulse opens.
2. The pre-auth gate is active.
3. Pulse logo, Pulse BETA, and "Restoring your session…" are shown.
4. Firebase onAuthStateChanged resolves.
5. Pulse selects Home, Login, Verify Email, or Profile Setup.
6. resolveAuthGate removes the pending state and the splash disappears.

The login page remains hidden while session restoration is pending.

Version: 8.5.4
Service-worker cache: v28

No Firebase rules or Supabase SQL changes are required.

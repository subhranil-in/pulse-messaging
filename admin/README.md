# Pulse Admin Dashboard

Standalone admin dashboard for Pulse Messaging.

## What it does
- Firebase Email/Password sign-in
- Firestore admin role check
- User analytics
- Active users list
- Storage usage
- Broadcast messages
- Moderation actions
- Admin logs

## Files
- `admin/index.html` — dashboard entry
- `admin/admin.js` — Firebase + Firestore logic
- `admin/admin.css` — dashboard styles
- `admin/admin.html` — redirect to `index.html`

## Firebase
This dashboard uses the same Firebase project as your main app.

It checks:
- `users/{uid}.role === "admin"`
- `users/{uid}.isAdmin === true`
- `users/{uid}.admin === true`
- fallback: `admins/{uid}` document exists

## GitHub Pages
For `/admin/` to work, the folder must contain `index.html`.

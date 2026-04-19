# EinfachRezept

Accessible single-page WebGL landing experience for easy recipe category selection.

## Run locally

Open `./index.html` in a browser.

## Login & content editing (ready to use)

- Login using provided information.
- The app ensures two default admin users exist with full editing rights.
- The page starts with scrolling locked; users continue only via "START".
- Logged-in users can edit:
  - site texts (title, subtitle, labels),
  - category buttons (add/remove buttons, rename buttons, edit option lists),
  - per-category button colors (button background + text color),
  - optional local image upload per category button (image is shown behind the button text),
  - separate background image uploads for landing page, category page, and each options step,
  - colors and WebGL animation settings.
- Click **Änderungen speichern** to persist changes.

All users, sessions, and content settings are stored in browser `localStorage` for static hosting compatibility.

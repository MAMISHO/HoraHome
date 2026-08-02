---
name: ionic-angular-ux
description: Best practices, visual design patterns, and UX guidelines for Ionic 8 + Angular mobile applications.
---

# Ionic 8 + Angular Mobile UX Guidelines

## 1. Visual Aesthetics & Polish
- **Color Tokens**: Use HSL tailored CSS variables in `theme/variables.scss` for smooth light/dark mode transitions and premium contrast.
- **Card & Surface Elevation**: Combine subtle box-shadows, rounded corners (`border-radius: 16px`), and glassmorphism overlays for cards and modals.
- **Typography & Scale**: Use clear hierarchy with Google Font Inter or Outfit, proper line-heights, and readable touch font sizes (minimum 14px body, 18-24px headers).

## 2. Interactive Calendar (`ion-datetime`)
- Use `<ion-datetime presentation="date" [preferWheel]="false" [highlightedDates]="highlightedDates"></ion-datetime>` for inline month/day calendar views.
- Custom date highlights: Use `highlightedDates` array or function to distinguish working days vs public holidays (Brussels holidays) with distinct background and text colors.
- i18n Localization: Pass `locale="es-ES"` (or bind dynamically to `LanguageService`) for localized day names, month names, and first-day-of-week settings.

## 3. Micro-animations & Feedback
- Incorporate subtle hover/active states using `ion-ripple-effect` or CSS transform scales (`transform: scale(0.98)` on touch).
- Use Haptics API (`@capacitor/haptics`) for tactile feedback on key user actions (e.g. logging work hours, saving clients).

## 4. Layout & Navigation
- Modular NgModule design (`standalone: false`).
- Bottom tab navigation (`ion-tab-bar`) with clear, descriptive icons (`ionicons`).

# Proposal: HoraHome Initial Mobile Application

## Intent
Build the initial version of **HoraHome**, a mobile application for domestic service tracking (Cleaning, Childcare, Ironing, Cooking) tailored for clients in the Brussels-Capital Region. The application operates 100% offline using a local SQLite database (`db_horahome.db`) via TypeORM and supports backup/restore to a private Google Drive app folder (`appDataFolder`).

## Technical Stack
- **Framework**: Ionic 8 + Angular 18+ (**NgModule Components architecture**, RxJS, Signals)
- **Native Engine**: Capacitor 6+ (Android)
- **ORM & Local Persistence**: TypeORM (`typeorm`, `reflect-metadata`) over `@capacitor-community/sqlite`
- **File System**: `@capacitor/filesystem`
- **Cloud Backup**: `@codetrix-studio/capacitor-google-auth` + Google Drive REST API (`appDataFolder`)
- **Internationalization (i18n)**: `@ngx-translate/core` + `@ngx-translate/http-loader` (Default: Spanish `es`, multi-language support for English `en` and French `fr`)
- **Charts**: `chart.js` / `ng2-charts`

## Core Features
1. **Dashboard (Tab 1)**: Key performance indicators (monthly hours, month-over-month comparison, top client, upcoming Brussels holiday banner, donut chart breakdown, quick-add FAB).
2. **Interactive Calendar (Tab 2)**: Monthly calendar visualization with Brussels holidays highlights, work log badges, and a 3-click quick log modal flow.
3. **Work Logs History (Tab 3)**: Chronological history with notes search, client filtering, log editing, and safe deletion with a 4-second Undo toast.
4. **Clients Management (Tab 4)**: Manage client directory, hourly rates, and Active/Inactive toggle (preserving historical logs).
5. **Reports & Cloud Settings (Tab 5)**: Date range aggregation (Day, Week, Month, Year, Custom Range), financial calculation ($\text{Hours} \times \text{Hourly Rate}$), language selector (ES/EN/FR), Google Auth session, and Google Drive database backup/restore.

## Success Criteria
- Native Android build completes without errors (`ionic build` / `ng build`).
- Angular NgModule setup initialized without standalone components.
- TypeORM entities (`Client`, `Service`, `WorkLog`, `BrusselsHoliday`) operational in SQLite.
- Multi-language i18n working with Spanish default, English and French options.
- Safe deletion with 4-second undo grace period functioning as specified.
- Database backup to and restoration from Google Drive `appDataFolder`.

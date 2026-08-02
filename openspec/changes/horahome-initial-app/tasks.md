# Tasks: HoraHome Implementation Steps

- [x] 1. Project Initialization & Native Setup
  - [x] 1.1 Generate Ionic 8 Angular project using `NgModule` component architecture (modules instead of standalone).
  - [x] 1.2 Install Capacitor dependencies (`@capacitor-community/sqlite`, `@capacitor/filesystem`, `@capacitor/network`, `@codetrix-studio/capacitor-google-auth`, `chart.js`, `ng2-charts`).
  - [x] 1.3 Install TypeORM and ORM dependencies (`typeorm`, `reflect-metadata`) and i18n (`@ngx-translate/core`, `@ngx-translate/http-loader`).
  - [x] 1.4 Add Android platform and configure Capacitor config (`appId: com.horahome.app`, GoogleAuth settings).

- [x] 2. Core Persistence & Data Layer (TypeORM & i18n)
  - [x] 2.1 Create TypeORM entities in English (`client.entity.ts`, `service.entity.ts`, `work-log.entity.ts`, `brussels-holiday.entity.ts`).
  - [x] 2.2 Create translation JSON files in `src/assets/i18n/` (`es.json`, `en.json`, `fr.json`).
  - [x] 2.3 Implement `LanguageService` for language switching and default Spanish configuration.
  - [x] 2.4 Implement `DatabaseService` with TypeORM DataSource initialization, service seeding, and repository access methods.

- [x] 3. Cloud Authentication & Backup Services
  - [x] 3.1 Implement `GoogleAuthService` using Angular Signals for user state.
  - [x] 3.2 Implement `GoogleDriveService` for database file backup/restore via `appDataFolder` REST API.

- [x] 4. Tab Modules & Presentation Implementation
  - [x] 4.1 Implement Shared Module and Work Log Modal component with i18n pipe integration.
  - [x] 4.2 Implement Dashboard Module (Tab 1) with KPI cards, top client, holiday banner, donut chart, and Quick-Add FAB.
  - [x] 4.3 Implement Calendar Module (Tab 2) with holiday highlights, work log badges, and 3-click quick log modal flow.
  - [x] 4.4 Implement Work Logs Module (Tab 3) with search, client filtering, edit modal, and 4-second Undo toast deletion flow.
  - [x] 4.5 Implement Clients Module (Tab 4) with client CRUD forms and Active/Inactive toggle.
  - [x] 4.6 Implement Reports & Settings Module (Tab 5) with aggregation metrics, date range filters, language selector UI, Google login, and backup/restore controls.

- [x] 5. Verification & Testing
  - [x] 5.1 Run project build (`ng build`) to confirm zero compilation errors.
  - [x] 5.2 Verify offline SQLite operations, TypeORM entity mappings, and i18n translation switching.

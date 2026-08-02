# Spec: HoraHome Core Domain & UI Capabilities

## Capability: Architecture & Module Components
- The application MUST use Angular `NgModule` component architecture instead of standalone components.

## Capability: TypeORM Data Modeling (English Domain)
- The system MUST define database entities using TypeORM in English:
  - `Client`: `id`, `name`, `address`, `phone`, `hourlyRate`, `isActive`, `createdAt`.
  - `Service`: `id`, `name`.
  - `WorkLog`: `id`, `workDate`, `client`, `service`, `hours`, `notes`, `createdAt`.
  - `BrusselsHoliday`: `holidayDate`, `nameFr`, `nameNl`, `year`.
- The system MUST exclude inactive clients from quick-add pickers while preserving their historic work log entries in reporting.

## Capability: Multi-Language Support (i18n)
- The system MUST provide multi-language UI translation using `@ngx-translate/core`.
- The system MUST use Spanish (`es`) as the default language, with support for English (`en`) and French (`fr`).

## Capability: Services Catalog
- The system MUST maintain a closed catalog of 4 service types: `Cleaning`, `Childcare`, `Ironing`, `Cooking`.
- The system MUST seed these services via TypeORM during application initialization.

## Capability: Work Logs Constraints
- The system MUST restrict each work log entry to belong to exactly one client and one service type.
- The system MUST validate logged hours between $0.5$ and $24.0$.

## Capability: Brussels Region Holidays
- The system MUST store and display official Brussels-Capital Region holidays (`holidayDate`, `nameFr`, `nameNl`, `year`).

## Capability: Dashboard
- The system MUST display total monthly hours, month-over-month variation, top client, next holiday banner, donut chart breakdown, and a quick-add FAB for today's date.

## Capability: Calendar & 3-Click Log
- The system MUST render monthly calendar visual badges for logged hours and holiday indicators.
- The system MUST support a 3-touch log flow: date select -> client select -> save.

## Capability: Work Logs History & Deletion Undo
- The system MUST list work logs chronologically descending with text search and client filtering.
- The system MUST confirm deletion, hide item immediately, and provide a 4-second Undo toast before executing physical deletion in SQLite.

## Capability: Clients Management
- The system MUST provide client creation/editing forms and an Active/Inactive toggle.

## Capability: Reports & Cloud Sync
- The system MUST summarize hours, service subtotals, and estimated revenue by date range filters.
- The system MUST provide a language selector component (ES / EN / FR).
- The system MUST authenticate via Google Sign-In and support database backup and restore to Google Drive `appDataFolder`.

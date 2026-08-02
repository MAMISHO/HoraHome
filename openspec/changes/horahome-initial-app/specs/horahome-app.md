# Specification: HoraHome Core Domain and UI Requirements

## Requirement 1: Client Entity and Lifecycle
- **Entity Fields**: `id` (UUID v4), `name` (required text), `address` (optional text), `phone` (optional text), `hourly_rate` (decimal $\ge 0$), `is_active` (boolean, default `true`), `created_at` (timestamp).
- **Rules**:
  - Inactive clients must be excluded from quick-add selection pickers.
  - Inactive clients must retain their historical data in work logs and report statistics.

## Requirement 2: Closed Catalog Services
- Four closed service types:
  1. `Cleaning`
  2. `Childcare`
  3. `Ironing`
  4. `Cooking`
- Seeded into SQLite `services` table during app initialization (`APP_INITIALIZER`).

## Requirement 3: Work Log Records
- **Entity Fields**: `id` (UUID v4), `work_date` (ISO string `YYYY-MM-DD`), `client_id` (FK), `service_id` (FK), `hours` (decimal between $0.5$ and $24.0$), `notes` (optional text), `created_at` (timestamp).
- **Domain Constraint**: A work log record must belong to exactly **one client** and **one service type**.

## Requirement 4: Brussels Region Official Holidays
- Entity `brussels_holidays`: `holiday_date` (`YYYY-MM-DD`), `name_fr` (text), `name_nl` (text), `year` (integer).
- Pre-loaded with official Brussels-Capital Region holidays for current year.

## Requirement 5: Hybrid Dashboard (Tab 1)
- Monthly total hours KPI card with comparison versus prior month (e.g., `+12.5 hrs vs last month`).
- Top Client card identifying client with highest total hours in current month.
- Upcoming Brussels Holiday banner showing nearest upcoming holiday.
- Service breakdown Donut Chart (`Chart.js`).
- Quick-Add FAB ("Registrar Hoy" / "Log Today") opening quick-log bottom sheet pre-selecting today's date.

## Requirement 6: Interactive Calendar and 3-Click Logging (Tab 2)
- Monthly calendar with visual highlights:
  - Brussels Holiday: Special background/accent color.
  - Day with Logged Hours: Hours badge or client color indicator.
  - Worked Holiday: Combined indicator.
- 3-Click UX Flow:
  1. Tap empty/holiday date $\rightarrow$ Open Bottom Sheet with date header and holiday label if applicable.
  2. Tap Client chip $\rightarrow$ Auto-select client's default service and default hours (e.g., 4.0h).
  3. Tap "Save" $\rightarrow$ Persist in SQLite and update calendar badge immediately.

## Requirement 7: Work Logs History and Deletion Undo (Tab 3)
- Chronological list sorted descending by `work_date`.
- Full-text search on `notes` field and client filter.
- Inline/Modal editing with 0.5h step incrementers (`-` / `+`).
- Safe Deletion Flow:
  1. Confirmation dialog: *"Delete [X] hours from [Client]?"*.
  2. Upon confirmation, temporarily hide item and trigger a 4-second `ion-toast` with an **Undo** button.
  3. If Undo is clicked within 4 seconds, restore item. Otherwise, execute permanent SQLite `DELETE`.

## Requirement 8: Client Catalog Management (Tab 4)
- Form modal for creating/editing clients.
- Toggle for Active/Inactive status.

## Requirement 9: Reports and Financial Summary (Tab 5)
- Date range filters: Today, Current Week, Current Month, Current Year, Custom Date Range.
- Aggregations: Total hours, hours per service type, estimated earnings ($\text{Hours} \times \text{Hourly Rate}$).
- Entity filter: All clients vs. Specific client.

## Requirement 10: Google Drive Cloud Sync (Tab 5)
- Google Auth Sign-In with `https://www.googleapis.com/auth/drive.appdata` scope.
- Manual "Backup Now" operation exporting local `db_horahome.db` to Google Drive `appDataFolder`.
- Manual "Restore Data" operation downloading latest `db_horahome.db` from `appDataFolder` and refreshing local database connection.
- Timestamp label indicating last successful backup.

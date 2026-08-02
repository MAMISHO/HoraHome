# HoraHome - Especificación Funcional General y Modelo de Dominio

## 1. Visión General del Producto
**HoraHome** es una aplicación móvil diseñada para el registro, seguimiento y gestión de horas de trabajo doméstico (Limpieza, Cuidado de niños, Planchado y Cocina) para clientes en la Región de Bruselas-Capital. Permite operar al 100% en modo sin conexión (offline) mediante SQLite local y ofrece sincronización en la nube con Google Drive (`appDataFolder`).

---

## 2. Entidades de Datos y Reglas de Dominio

### 2.1 Clientes (`clients`)
* Representa a la persona o entidad receptora del servicio.
* **Campos**:
  * `id`: UUID v4 (Clave Primaria).
  * `name`: Texto obligatorio.
  * `address`: Texto opcional.
  * `phone`: Texto opcional.
  * `hourly_rate`: Decimal $\ge 0$ (Tarifa por hora en EUR).
  * `is_active`: Booleano (por defecto `true`).
  * `created_at`: Timestamp de creación.
* **Regla de Negocio**: Los clientes inactivos no aparecen en los selectores rápidos de nuevo registro, pero su histórico se mantiene íntegro en reportes y estadísticas.

### 2.2 Servicios (`services`)
* Catálogo cerrado de 4 tipos de servicio prestados:
  1. `Cleaning` (Limpieza)
  2. `Childcare` (Cuidado de niños)
  3. `Ironing` (Planchado)
  4. `Cooking` (Cocina)

### 2.3 Registros de Trabajo (`work_logs`)
* **Regla de Oro**: Un registro de trabajo pertenece a **un solo cliente** y a **un solo tipo de servicio**.
* **Campos**:
  * `id`: UUID v4 (Clave Primaria).
  * `work_date`: Fecha en formato ISO `YYYY-MM-DD`.
  * `client_id`: FK a `clients.id`.
  * `service_id`: FK a `services.id`.
  * `hours`: Decimal entre $0.5$ y $24.0$ horas.
  * `notes`: Texto libre opcional (concepto o notas de la sesión).
  * `created_at`: Timestamp de creación.

### 2.4 Festivos de Bruselas (`brussels_holidays`)
* Calendario oficial de festivos en la Región de Bruselas-Capital (Belgas Nacionales + Regionales).
* **Campos**:
  * `holiday_date`: Fecha `YYYY-MM-DD` (Clave Primaria).
  * `name_fr`: Nombre oficial en francés.
  * `name_nl`: Nombre oficial en holandés.
  * `year`: Año fiscal (ej. `2026`).

---

## 3. Matriz de Comportamiento Offline y Sync
* Operatividad local 100% mediante SQLite (`db_horahome.db`).
* Sincronización manual/automática hacia Google Drive privada (`appDataFolder`) sin depender de servidor propio.

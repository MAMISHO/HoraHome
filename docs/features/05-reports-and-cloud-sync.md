# Feature Spec: Reportes y Copia de Seguridad en Google Drive (Tab 5)

## 1. Propósito
Motor de agregación estadística y gestión de copias de seguridad en la nube (Google Drive).

---

## 2. Sección Motor de Reportes

### 2.1 Filtros Temporales Seleccionables
* **Por Día**: Registros del día seleccionado.
* **Por Semana**: Suma de horas acumuladas de lunes a domingo de la semana activa.
* **Por Mes**: Filtro mensual (ej. Julio 2026).
* **Por Año**: Resumen del año fiscal seleccionado.
* **Rango Personalizado**: Selector mediante Date Picker de Fecha Inicio y Fecha Fin.

### 2.2 Filtros por Entidad
* **Todos los Clientes**: Suma global de horas y desglose en lista por cada cliente.
* **Cliente Específico**: Muestra únicamente las horas, notas y servicios prestados a ese cliente en el periodo seleccionado.

### 2.3 Métricas y Salida de Datos
* **Total de Horas Trabajadas**: Suma de horas en el periodo/filtro activo.
* **Subtotal por Tipo de Servicio**: Horas dedicadas a `Cleaning`, `Childcare`, `Ironing` y `Cooking`.
* **Cálculo Económico Estimado**: Suma de $(\text{Horas} \times \text{Tarifa por Hora del Cliente})$ para las entradas pertenecientes al periodo seleccionado.

---

## 3. Sección Autenticación y Backup en la Nube (Google Drive)

### 3.1 Autenticación (Google Sign-In)
* Muestra avatar, nombre y correo del usuario autenticado o botón *"Iniciar sesión con Google"*.
* Requiere el scope privado de Google Drive:
  `https://www.googleapis.com/auth/drive.appdata`

### 3.2 Operación de Respaldo (Backup)
1. Exporta el archivo físico `.db` local (`db_horahome.db`).
2. Realiza un `POST/PATCH` a la API REST de Google Drive hacia la carpeta `appDataFolder`.
3. Actualiza el indicador visual en pantalla: *"Último respaldo: DD/MM/YYYY HH:mm"*.

### 3.3 Operación de Restauración (Restore)
1. Consulta y descarga el archivo `.db` más reciente almacenado en `appDataFolder` de Google Drive.
2. Reemplaza la base de datos local SQLite (`db_horahome.db`) utilizando `@capacitor/filesystem`.
3. Refresca la conexión del `DatabaseService` y re-emite los estados/Signals de la aplicación.

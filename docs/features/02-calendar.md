# Feature Spec: Calendario Interactivo y Alta Rápida (Tab 2)

## 1. Propósito
Visualización temporal del mes y registro de horas en exactamente 3 clics/toques.

## 2. Indicadores Visuales en el Calendario
* **Día Festivo de Bruselas**: Destacado con un estilo visual diferencial (ej. dorado/rojo) y tooltip/etiqueta informativa.
* **Día con Horas Trabajadas**: Badge informativo con la cifra total de horas (ej. `4.5h`) o indicador del cliente correspondiente.
* **Festivo Trabajado**: Indicador combinado (Badge de horas + marca de día festivo).

## 3. Flujo UX de Registro en 3 Clics

```mermaid
sequenceDiagram
    autonumber
    User->>CalendarPage: 1. Toca un día en el calendario
    CalendarPage->>BottomSheet: Abre Bottom Sheet (si es festivo muestra etiqueta)
    User->>BottomSheet: 2. Toca Tarjeta / Chip del Cliente
    BottomSheet->>BottomSheet: Autoselecciona servicio habitual y horas por defecto (ej. 4.0h)
    User->>BottomSheet: 3. Toca "Guardar"
    BottomSheet->>SQLite: Inserta registro en work_logs
    SQLite-->>CalendarPage: Refresca badges e indicadores del calendario
```

### Detalle de Pasos:
1. **Clic 1**: Tocar un día en el calendario $\rightarrow$ Se despliega el *Bottom Sheet*. En la cabecera se especifica la fecha y, si coincide con un festivo de Bruselas, se indica el nombre oficial.
2. **Clic 2**: Tocar la tarjeta/chip de un Cliente $\rightarrow$ La app autoselecciona el servicio habitual de dicho cliente y asigna las horas por defecto.
3. **Clic 3**: Tocar el botón **"Guardar"** $\rightarrow$ Se valida y almacena el registro en SQLite, cerrando el panel e incrementando dinámicamente el badge del día en el calendario.

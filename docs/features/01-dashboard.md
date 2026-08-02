# Feature Spec: Dashboard Híbrido (Tab 1)

## 1. Propósito
Ofrecer un resumen ejecutivo inmediato de la actividad del mes en curso y permitir la adición ultrarrápida de horas para el día de hoy.

## 2. Componentes de la Interfaz (UI)

### 2.1 Tarjeta KPI Principal (Acumulado Mensual)
* Muestra las horas totales trabajadas en el mes en curso.
* Muestra la variación incremental/decremental comparada con el mes anterior (ej. `+12.5 hrs vs mes anterior`).

### 2.2 Tarjeta Cliente Top
* Identifica y muestra el cliente que acumula el mayor volumen de horas prestadas en el mes actual.

### 2.3 Banner de Festivo Cercano
* Detecta y muestra el próximo festivo de la Región de Bruselas registrado en el calendario local.
* Ejemplo: *"15 de Agosto: Assomption / Onze Lieve Vrouw Hemelvaart"*.

### 2.4 Gráfico Resumen por Servicio
* Gráfico de tipo Donut (`Chart.js` / `ng2-charts`).
* Representa el porcentaje de horas distribuidas entre Limpieza, Cuidado de niños, Planchado y Cocina en el periodo activo.

### 2.5 Botonera de Acción Rápida (FAB / Quick-Add)
* Botón flotante siempre visible: **"Registrar Hoy"**.
* Al ser pulsado, abre el *Bottom Sheet* de registro con la fecha pre-seleccionada en la fecha actual (`hoy`).

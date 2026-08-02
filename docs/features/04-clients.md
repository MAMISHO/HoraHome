# Feature Spec: Gestión de Clientes (Tab 4)

## 1. Propósito
Administración completa del catálogo de clientes y tarifas asociadas.

## 2. Funcionalidades Principales
* **Alta de Cliente**: Formulario modal para ingresar Nombre (Obligatorio), Teléfono (Opcional), Dirección (Opcional) y Tarifa por Hora (Opcional, $\ge 0$).
* **Edición de Cliente**: Modificación de datos existentes.
* **Estado Activo / Inactivo**:
  * Toggle para activar/desactivar el cliente.
  * **Regla de Negocio**: Un cliente inactivo no se muestra en la selección rápida del calendario/dashboard, pero sus registros de trabajo pasados y tarifas históricas se preservan para los reportes y estadísticas globales.

# HoraHome (codebros)

Aplicación móvil de gestión de tiempo y horas construida con Ionic, Angular y Capacitor para Android.

---

## 📋 Requisitos Previos

Antes de compilar o empaquetar la aplicación para producción, asegúrate de contar con los siguientes requisitos en tu sistema:

1. **Node.js**: v18+ y `npm`.
2. **Android SDK & JDK**:
   - JDK 17 o superior instalado.
   - Android SDK con `cmdline-tools` y `platform-tools` configurados.
   - Herramienta `keytool` disponible en el `PATH` (incluida en el JDK).
3. **Variables de Entorno para Firma (Producción)**:
   Puedes configurar las siguientes variables en tu archivo de shell (`~/.zshrc` o `~/.bashrc`), o bien mediante `android/key.properties`:
   ```bash
   export ANDROID_KEYSTORE_PASSWORD="tu_contraseña_de_keystore"
   export ANDROID_KEY_PASSWORD="tu_contraseña_de_clave"
   export ANDROID_KEY_ALIAS="app-keystore-key"                    # Opcional (por defecto: codebros-upload-key)
   export ANDROID_KEYSTORE_PATH="/ruta/absoluta/a/upload-keystore.jks" # Opcional (por defecto: ../app/upload-keystore.jks)
   ```

---

## 🛠️ Inicialización del Entorno de Desarrollo (`setup-env.sh`)

Al clonar el proyecto o antes de abrir la solución en **Android Studio / VSCode**, ejecuta el comando de preparación de entorno:

```bash
npm run setup
# O directamente:
./setup-env.sh
```

**¿Qué hace este comando?**
1. Genera los archivos de trabajo requeridos por los IDEs y Capacitor (`capacitor.config.json`, `android/app/src/main/res/values/strings.xml`, `android/key.properties`, `src/assets/google-config.json`) copiándolos desde sus plantillas `.example`.
2. Inyecta tus variables de entorno locales si ya las tienes definidas.
3. Garantiza que la carpeta de Android pueda compilarse sin errores en Android Studio sin ensuciar Git con credenciales reales.


## 🔐 Gestión de Keystore en Equipo (Google Play App Signing)

Para mantener la seguridad y permitir que cualquier miembro del equipo o CI/CD pueda compilar la versión de producción:

1. **Google Play App Signing**: Google administra la clave principal de la app en la nube. La Keystore local (`upload-keystore.jks`) actúa como la **Upload Key (Clave de Subida)**.
2. **Almacenamiento Seguro**: El archivo `android/app/upload-keystore.jks` **nunca se sube al repositorio Git**. Está guardado en el gestor de secretos compartido de **codebros** (ej. 1Password / Vault).
3. **Nuevo Desarrollador**: Para compilar en modo `--release`, descarga el archivo `upload-keystore.jks` del gestor seguro a la ruta local `android/app/upload-keystore.jks` y configura las variables de entorno en su terminal.

---

## 🚀 Empaquetado y Compilación

El proyecto incluye un script unificado (`deploy.sh`) que automatiza todo el proceso de compilación, generación de firmas y creación de artefactos.

### 1. Compilación de Producción (Release APK + AAB para Play Store)

Para generar los paquetes firmados de distribución:

```bash
./deploy.sh --release
```

**¿Qué hace este comando automáticamente?**
1. Carga las variables de entorno de tu shell (`~/.zshrc`).
2. Verifica la existencia del almacén de claves (`upload-keystore.jks`). Si no existe, lo genera automáticamente usando tus credenciales.
3. Compila la aplicación Angular en modo producción y sincroniza los assets con Capacitor.
4. Genera los artefactos de salida firmados:
   - **AAB (Android App Bundle para Google Play Store)**: `android/app/build/outputs/bundle/release/app-release.aab`
   - **APK de Release**: `android/app/build/outputs/apk/release/app-release.apk`

---

### 2. Compilación y Despliegue en Modo Desarrollo (Debug)

Para compilar, instalar y verificar la aplicación en un dispositivo o emulador conectado:

```bash
./deploy.sh
```

Opciones adicionales del script:
- `./deploy.sh --no-install`: Compila el APK de Debug sin instalarlo en el dispositivo.
- `./deploy.sh --apk-only`: Omite la compilación de Angular y solo re-compila el APK Android.

---

## 🔒 Configuración Alternativa de Firma (`key.properties`)

Si prefieres no usar variables de entorno globales, puedes crear un archivo `android/key.properties` basado en la plantilla `android/key.properties.example`:

```properties
storePassword=${ANDROID_KEYSTORE_PASSWORD:'contraseñaDefault'}
keyPassword=${ANDROID_KEY_PASSWORD:'contraseñaDefault'}
keyAlias=codebros-upload-key
storeFile=../app/upload-keystore.jks

# Google OAuth & Drive Backup Config
googleWebClientId=${HORAHOME_WEB_APP_CLIENT_ID:'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com'}
googleClientSecret=${HORAHOME_WEB_APP_SECRET_ID:''}
googleAndroidClientId=${HORAHOME_ANDROID_CLIENT_ID:''}
googleAndroidDebugClientId=${HORAHOME_ANDEBUG_CLIENT_ID:''}
```

---

## 🔑 Configuración de Google OAuth y Google Drive Backup

Para habilitar el inicio de sesión con Google y las copias de seguridad en Google Drive:

1. **Google Cloud Console**:
   - Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
   - En **Pantalla de consentimiento de OAuth**, selecciona scopes `profile`, `email`, y `https://www.googleapis.com/auth/drive.appdata`.
   - Crea un **ID de Cliente Web (Web Client ID)**.
   - Crea dos **ID de Cliente de Android** (uno para Release y uno para Debug), introduciendo:
     - Nombre de paquete: `es.codebros.horahome`
     - Huella digital SHA-1 de Release: Obtenida del Keystore oficial (`codebros-upload-key`).
     - Huella digital SHA-1 de Debug: Obtenida de `~/.android/debug.keystore`.
2. **Configuración de Variables**:
   Puedes definir los Client IDs en tus variables de entorno (`~/.zshrc`):
   ```bash
   export HORAHOME_WEB_APP_CLIENT_ID="123456789-abc.apps.googleusercontent.com"
   export HORAHOME_WEB_APP_SECRET_ID="GOCSPX-..."
   export HORAHOME_ANDROID_CLIENT_ID="123456789-release.apps.googleusercontent.com"
   export HORAHOME_ANDEBUG_CLIENT_ID="123456789-debug.apps.googleusercontent.com"
   ```
   O configurar `googleWebClientId` dentro de `android/key.properties`.

---

## 🏗️ Arquitectura de Plantillas y Seguridad (Git Clean Workflow)

Para evitar que credenciales, firmas y tokens privados se suban por accidente a Git, el proyecto implementa un patrón estricto de **Plantillas (`*.example`) autogeneradas**:

| Archivo en Git (Plantilla) | Archivo Generado en Runtime (Ignorado en `.gitignore`) | Función |
|---|---|---|
| `android/key.properties.example` | `android/key.properties` | Configuración de firma Keystore y credenciales OAuth |
| `android/strings.xml.example` | `android/app/src/main/res/values/strings.xml` | Recurso nativo Android para Capacitor GoogleAuth (`server_client_id`) |
| `capacitor.config.json.example` | `capacitor.config.json` | Configuración principal de Capacitor para Android |
| *(N/A - Generado al volar)* | `src/assets/google-config.json` | Configuración consumida por el frontend de Angular |

### Flujo de Trabajo para el Equipo de Desarrollo:

1. **Preparación del Entorno (IDE Setup)**:
   Al clonar el repositorio o preparar el entorno de trabajo, ejecuta:
   ```bash
   npm run setup
   # O directamente:
   ./setup-env.sh
   ```
   *Este script es 100% multiplataforma y desacoplado: simplemente se encarga de crear los archivos locales de trabajo copiándolos desde sus plantillas `.example` si no existen. Esto evita que Android Studio o VSCode reporten errores por archivos faltantes.*

2. **Compilación y Despliegue (`./deploy.sh`)**:
   - Cada desarrollador parametriza sus credenciales/variables en sus variables de entorno o en su copia local de `android/key.properties`.
   - Al ejecutar `./deploy.sh` (o `./deploy.sh --release`), el script inyecta automáticamente las credenciales reales en los archivos generados durante la compilación.
   - **Los archivos generados con credenciales están incluidos en `.gitignore` y nunca se suben al repositorio.**






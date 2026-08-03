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
   Puedes configurar las siguientes 4 variables en tu archivo de shell (`~/.zshrc` o `~/.bashrc`), o bien mediante `android/key.properties`:
   ```bash
   export ANDROID_KEYSTORE_PASSWORD="tu_contraseña_de_keystore"
   export ANDROID_KEY_PASSWORD="tu_contraseña_de_clave"
   export ANDROID_KEY_ALIAS="app-keystore-key"                    # Opcional (por defecto: codebros-upload-key)
   export ANDROID_KEYSTORE_PATH="/ruta/absoluta/a/upload-keystore.jks" # Opcional (por defecto: ../app/upload-keystore.jks)
   ```

---

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
```

*Nota: Este archivo está incluido en `.gitignore` para proteger tus credenciales.*

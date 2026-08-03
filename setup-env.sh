#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# HoraHome — Environment Setup Script
# Genera los archivos locales de desarrollo a partir
# de sus plantillas .example para IDEs (Android Studio/VSCode)
#
# Usage:
#   ./setup-env.sh
#   npm run setup
# ──────────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"

echo "▸ Preparando entorno de desarrollo para HoraHome…"

# 1. Copiar android/key.properties desde plantilla
KEY_EXAMPLE="$ANDROID_DIR/key.properties.example"
KEY_FILE="$ANDROID_DIR/key.properties"

if [ ! -f "$KEY_FILE" ] && [ -f "$KEY_EXAMPLE" ]; then
  cp "$KEY_EXAMPLE" "$KEY_FILE"
  echo "  ✔ android/key.properties creado desde plantilla."
else
  echo "  ℹ android/key.properties ya existe."
fi

# 2. Copiar capacitor.config.json desde plantilla
CAPACITOR_CFG_EXAMPLE="$PROJECT_DIR/capacitor.config.json.example"
CAPACITOR_CFG="$PROJECT_DIR/capacitor.config.json"

if [ ! -f "$CAPACITOR_CFG" ] && [ -f "$CAPACITOR_CFG_EXAMPLE" ]; then
  cp "$CAPACITOR_CFG_EXAMPLE" "$CAPACITOR_CFG"
  echo "  ✔ capacitor.config.json creado desde plantilla."
else
  echo "  ℹ capacitor.config.json ya existe."
fi

# 3. Copiar android/app/src/main/res/values/strings.xml desde plantilla
STRINGS_XML_EXAMPLE="$ANDROID_DIR/strings.xml.example"
STRINGS_XML_DIR="$ANDROID_DIR/app/src/main/res/values"
STRINGS_XML="$STRINGS_XML_DIR/strings.xml"

mkdir -p "$STRINGS_XML_DIR"

if [ ! -f "$STRINGS_XML" ] && [ -f "$STRINGS_XML_EXAMPLE" ]; then
  cp "$STRINGS_XML_EXAMPLE" "$STRINGS_XML"
  echo "  ✔ android/app/src/main/res/values/strings.xml creado desde plantilla."
else
  echo "  ℹ android/app/src/main/res/values/strings.xml ya existe."
fi

# 4. Crear plantilla inicial de src/assets/google-config.json si no existe
GOOGLE_CFG="$PROJECT_DIR/src/assets/google-config.json"
if [ ! -f "$GOOGLE_CFG" ]; then
  mkdir -p "$PROJECT_DIR/src/assets"
  cat << 'EOF' > "$GOOGLE_CFG"
{
  "clientId": "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
  "clientSecret": ""
}
EOF
  echo "  ✔ src/assets/google-config.json creado con valores por defecto."
else
  echo "  ℹ src/assets/google-config.json ya existe."
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "✔ Entorno listo para Android Studio y VSCode."
echo "  Recuerda parametrizar tus credenciales locales en"
echo "  android/key.properties o en tus variables de entorno."
echo "────────────────────────────────────────────────────────────"

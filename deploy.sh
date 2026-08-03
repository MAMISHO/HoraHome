#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# HoraHome — Build, Sync, Deploy & Verify
# Usage:
#   ./deploy.sh              → debug build + install + verify on device
#   ./deploy.sh --release    → release build (APK only)
#   ./deploy.sh --no-install → debug build without installing
#   ./deploy.sh --apk-only   → skip Angular build, just recompile APK
# ──────────────────────────────────────────────

MODE="debug"
INSTALL=true
SKIP_WEB=false

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"

# Resolve adb from the Android SDK configured in local.properties
ADB="$( grep '^sdk.dir=' "$ANDROID_DIR/local.properties" | cut -d= -f2 )/platform-tools/adb"
if [ ! -x "$ADB" ]; then
  echo "⚠ adb not found at $ADB — falling back to PATH"
  ADB="adb"
fi

for arg in "$@"; do
  case "$arg" in
    --release)    MODE="release" ; INSTALL=false ;;
    --no-install) INSTALL=false ;;
    --apk-only)   SKIP_WEB=true ;;
    -h|--help)
      sed -n '3,10p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (use --help)"
      exit 1
      ;;
  esac
done

# ── 1. Angular build ────────────────────────
if [ "$SKIP_WEB" = false ]; then
  echo ""
  echo "▸ Building Angular app…"
  npm run build --prefix "$PROJECT_DIR"

  echo ""
  echo "▸ Syncing Capacitor → Android…"
  npx --prefix "$PROJECT_DIR" cap sync android
else
  echo ""
  echo "▸ Skipping web build (--apk-only)"
fi

# ── 2. Gradle build ────────────────────────
echo ""
if [ "$MODE" = "release" ]; then
  # Cargar variables del entorno del usuario si no están cargadas
  if [ -f "$HOME/.zshrc" ]; then
    set +e
    source "$HOME/.zshrc" 2>/dev/null || true
    set -e
  fi

  # 1. Leer key.properties si existe para extraer variables/fallbacks
  KEY_PROPS_FILE="$ANDROID_DIR/key.properties"
  
  parse_prop() {
    local prop_name="$1"
    local raw_val=""
    if [ -f "$KEY_PROPS_FILE" ]; then
      raw_val=$(grep "^${prop_name}=" "$KEY_PROPS_FILE" | cut -d= -f2- | tr -d '\r' || true)
    fi
    
    # Si contiene marcador ${ENV_VAR:'default'}
    if [[ "$raw_val" =~ \$\{([^}:]+)(:([^}]*))?\} ]]; then
      local env_var="${BASH_REMATCH[1]}"
      local default_val="${BASH_REMATCH[3]}"
      # Limpiar comillas del valor por defecto si existen
      default_val=$(echo "$default_val" | sed -e "s/^['\"]//" -e "s/['\"]$//")
      echo "${!env_var:-$default_val}"
    else
      echo "$raw_val"
    fi
  }

  PROP_STORE_FILE=$(parse_prop "storeFile")
  PROP_STORE_PASS=$(parse_prop "storePassword")
  PROP_KEY_PASS=$(parse_prop "keyPassword")
  PROP_KEY_ALIAS=$(parse_prop "keyAlias")

  # Resolver valores finales dando prioridad a variables de entorno explícitas
  KEYSTORE_REL="${ANDROID_KEYSTORE_PATH:-${PROP_STORE_FILE:-../app/upload-keystore.jks}}"
  if [[ "$KEYSTORE_REL" == /* ]]; then
    KEYSTORE_FILE="$KEYSTORE_REL"
  else
    KEYSTORE_FILE="$ANDROID_DIR/app/$KEYSTORE_REL"
  fi

  STORE_PASS="${ANDROID_KEYSTORE_PASSWORD:-$PROP_STORE_PASS}"
  KEY_PASS="${ANDROID_KEY_PASSWORD:-${ANDROID_KEY_PASS:-$PROP_KEY_PASS}}"
  KEY_ALIAS="${ANDROID_KEY_ALIAS:-${PROP_KEY_ALIAS:-codebros-upload-key}}"

  if [ ! -f "$KEYSTORE_FILE" ]; then
    echo "▸ Keystore no encontrada en $KEYSTORE_FILE. Generando automáticamente…"

    if [ -z "$STORE_PASS" ] || [ -z "$KEY_PASS" ]; then
      echo "✖ Error: Las contraseñas para la Keystore no se han encontrado."
      echo "  Por favor, defínelas en key.properties o en tu entorno (~/.zshrc)."
      exit 1
    fi

    mkdir -p "$(dirname "$KEYSTORE_FILE")"
    keytool -genkeypair -v \
      -keystore "$KEYSTORE_FILE" \
      -alias "$KEY_ALIAS" \
      -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=CodeBros, OU=Development, O=CodeBros, L=Madrid, ST=Madrid, C=ES" \
      -storepass "$STORE_PASS" \
      -keypass "$KEY_PASS"
    echo "✔ Keystore generada con éxito en $KEYSTORE_FILE."
  fi

  echo "▸ Assembling RELEASE APK & AAB (Bundle for Play Store)…"
  "$ANDROID_DIR/gradlew" -p "$ANDROID_DIR" assembleRelease bundleRelease
  APK_PATH=$(find "$ANDROID_DIR/app/build/outputs/apk/release" -name '*.apk' | head -1)
  AAB_PATH=$(find "$ANDROID_DIR/app/build/outputs/bundle/release" -name '*.aab' | head -1)
else
  if [ "$INSTALL" = true ]; then
    echo "▸ Building & installing DEBUG APK on device…"
    "$ANDROID_DIR/gradlew" -p "$ANDROID_DIR" installDebug
  else
    echo "▸ Assembling DEBUG APK…"
    "$ANDROID_DIR/gradlew" -p "$ANDROID_DIR" assembleDebug
  fi
  APK_PATH=$(find "$ANDROID_DIR/app/build/outputs/apk/debug" -name '*.apk' | head -1)
fi

# ── 3. Post-deploy verification ─────────────
if [ "$INSTALL" = true ] && [ "$MODE" = "debug" ]; then
  PACKAGE="es.codebros.horahome"

  echo ""
  echo "▸ Stopping app…"
  "$ADB" shell am force-stop "$PACKAGE"
  sleep 1

  echo "▸ Clearing logcat…"
  "$ADB" logcat -c

  echo "▸ Launching app…"
  "$ADB" shell am start -n "$PACKAGE/.MainActivity"
  sleep 6

  echo "▸ Checking logs for errors…"
  PID=$("$ADB" shell pidof -s "$PACKAGE" 2>/dev/null || echo "")

  if [ -z "$PID" ]; then
    echo ""
    echo "  ✖ App process not found — it may have crashed at startup."
    echo "  Full logcat:"
    "$ADB" logcat -d -t 50 | grep -iE "AndroidRuntime|FATAL|horahome" || true
    exit 1
  fi

  ERRORS=$("$ADB" logcat -d --pid="$PID" \
    | grep -iE "Capacitor/Console.*[Ee]rror|Capacitor.*JavaScript Error|AndroidRuntime|FATAL" \
    || true)

  if [ -n "$ERRORS" ]; then
    echo ""
    echo "  ⚠ JavaScript/runtime errors detected:"
    echo "$ERRORS" | head -10
    echo ""
    echo "  Run for full logs:"
    echo "    $ADB logcat -d --pid=\$($ADB shell pidof -s $PACKAGE)"
    EXIT_CODE=1
  else
    echo "  ✔ No errors — app is running cleanly."
    EXIT_CODE=0
  fi
fi

# ── 4. Summary ──────────────────────────────
echo ""
echo "────────────────────────────────────────"
echo "✔ Build complete!"
[ -n "${APK_PATH:-}" ] && echo "  APK → $APK_PATH"
[ -n "${AAB_PATH:-}" ] && echo "  AAB → $AAB_PATH"
[ "$INSTALL" = true ] && [ "$MODE" = "debug" ] && echo "  App verified on connected device."
echo "────────────────────────────────────────"

exit "${EXIT_CODE:-0}"

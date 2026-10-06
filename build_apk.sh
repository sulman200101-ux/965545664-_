#!/bin/bash
set -e

APP_DIR="/app/applet"
TOOLS_DIR="$APP_DIR/.tools"
mkdir -p "$TOOLS_DIR"

# 1. تثبيت Java 17 المحمولة (Portable JDK 17)
if [ ! -f "$TOOLS_DIR/jdk-17/bin/java" ]; then
  echo "Downloading Portable JDK 17..."
  curl -sL "https://adoptium.net/temurin/releases" > /dev/null 2>&1 || true
  curl -sL "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.10_7.tar.gz" -o "$TOOLS_DIR/jdk17.tar.gz"
  mkdir -p "$TOOLS_DIR/jdk-17"
  tar -xzf "$TOOLS_DIR/jdk17.tar.gz" -C "$TOOLS_DIR/jdk-17" --strip-components=1
  rm -f "$TOOLS_DIR/jdk17.tar.gz"
fi

export JAVA_HOME="$TOOLS_DIR/jdk-17"
export PATH="$JAVA_HOME/bin:$PATH"

echo "Java version:"
java -version

# 2. تثبيت Android SDK المحمول (Portable Android SDK)
SDK_DIR="$TOOLS_DIR/android-sdk"
mkdir -p "$SDK_DIR/cmdline-tools"

if [ ! -f "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "Downloading Android Commandline Tools..."
  curl -sL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o "$TOOLS_DIR/cmdtools.zip"
  unzip -q -o "$TOOLS_DIR/cmdtools.zip" -d "$SDK_DIR/cmdline-tools"
  rm -rf "$SDK_DIR/cmdline-tools/latest"
  mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
  rm -f "$TOOLS_DIR/cmdtools.zip"
fi

export ANDROID_HOME="$SDK_DIR"
export PATH="$SDK_DIR/cmdline-tools/latest/bin:$SDK_DIR/platform-tools:$PATH"

echo "Accepting licenses..."
yes | sdkmanager --sdk_root="$SDK_DIR" --licenses > /dev/null 2>&1 || true

echo "Installing platforms and build tools..."
yes | sdkmanager --sdk_root="$SDK_DIR" "platforms;android-34" "build-tools;34.0.0" "platform-tools" > /dev/null 2>&1 || true

# 3. إعداد local.properties
echo "sdk.dir=$SDK_DIR" > "$APP_DIR/android/local.properties"

# 4. بناء الـ APK عبر Gradle
echo "Building APK..."
cd "$APP_DIR/android"
chmod +x ./gradlew
./gradlew assembleDebug --no-daemon

# 5. نسخ الـ APK إلى مجلد public و dist
mkdir -p "$APP_DIR/public" "$APP_DIR/dist"
cp "$APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk" "$APP_DIR/public/app-release.apk" || true
cp "$APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk" "$APP_DIR/dist/app-release.apk" || true

echo "APK Build Complete!"
ls -la "$APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk" || true

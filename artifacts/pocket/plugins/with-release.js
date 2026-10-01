// Phase 123.4: the release build, kept in app.json's plugins so `expo prebuild` (android/ is
// generated, not committed) always writes it.
// - Version code: the minutes since 2026-01-01 UTC unless ANDROID_VERSION_CODE is given, the
//   stessa regola di QuoteAI (minuti dal 2026-01-01), così ogni build è più recente della precedente.
// - Signing: a release is signed with the Play upload key when ANDROID_KEYSTORE_PATH and the
//   ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD variables are set
//   (scripts/release-android.mjs reads them from ~/.prevai-keys/upload.properties); without
//   them it falls back to the debug key, as before.
const { withAppBuildGradle } = require("@expo/config-plugins");

const MARK = "// prevai: release signing and version code";

module.exports = function withRelease(config) {
  return withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (g.includes(MARK)) return c;
    g = g.replace(
      /^android \{/m,
      `${MARK}
def prevaiEnv = { String name, String fallback -> System.getenv(name) ?: fallback }
def prevaiKeystore = System.getenv("ANDROID_KEYSTORE_PATH")
def prevaiMinutes = String.valueOf((long) ((System.currentTimeMillis() - 1767225600000L) / 60000L))

android {`,
    );
    g = g.replace(/versionCode \d+/, 'versionCode prevaiEnv("ANDROID_VERSION_CODE", prevaiMinutes).toInteger()');
    g = g.replace(/versionName "([^"]*)"/, 'versionName prevaiEnv("ANDROID_VERSION_NAME", "$1." + prevaiMinutes)');
    g = g.replace(
      /signingConfigs \{\n(\s+)debug \{/,
      `signingConfigs {
$1if (prevaiKeystore) {
$1    release {
$1        storeFile file(prevaiKeystore)
$1        storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
$1        keyAlias System.getenv("ANDROID_KEY_ALIAS")
$1        keyPassword System.getenv("ANDROID_KEY_PASSWORD")
$1    }
$1}
$1debug {`,
    );
    g = g.replace(
      /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig prevaiKeystore ? signingConfigs.release : signingConfigs.debug",
    );
    c.modResults.contents = g;
    return c;
  });
};

# GMCT Connect Play Store Preparation

Last updated: October 22, 2026

## Current state

- Work is isolated on branch `feature/capacitor-mobile-app`. The production
  `main` branch has not been changed.
- Capacitor is configured for Android and iOS with app identifier
  `com.gmct.connect`.
- The regular web/PWA build remains separate from the native mobile build.
- Android targets API 36. The native build excludes the PWA service worker and
  uses the Capacitor geolocation plugin for Sunday self-attendance.
- Android Studio, Android SDK API 36, Android build tools, and the Android 16
  emulator are available on the development PC.
- The Android debug APK was installed and opened successfully in the emulator.
  The login screen renders and the browser-only PWA install prompt is hidden.
- The mobile bundle and both Android/iOS Capacitor projects synchronize.
- Web and mobile TypeScript builds and the attendance and app-update test suites
  passed during setup. ESLint could not run because this repository has no ESLint
  configuration.

## Play Console status

The developer account is a **personal account**. At the last check on
2026-10-22, Play Console showed:

- Identity documents submitted and under Google review.
- Real Android device verification still required. The emulator does not count;
  use a borrowed or owned non-rooted Android phone running Android 10 or newer,
  signed into the Play Console mobile app as the account owner.
- Contact phone verification still required after identity verification.
- Play Console currently blocks creating an app until account verification is
  complete. No app draft has been created and nothing has been published.

Google's personal-account production access requirement is a closed test with at
least 12 opted-in testers continuously for 14 days. Internal testing is still
the recommended first Play test after account setup is complete.

## Android build status

- App ID / Android application ID: `com.gmct.connect`
- Version name: `1.0.2`
- Android version code: `1`
- Android release bundle was built at
  `android/app/build/outputs/bundle/release/app-release.aab`.
- The AAB is **unsigned** and cannot be uploaded yet.
- The generated starter launcher icons are not approved GMCT branding.
- The iOS project is generated, but building/signing it requires macOS and Xcode.

The build commands on this Windows PC (using Android Studio's bundled Java) are:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
npm run cap:sync
.\android\gradlew.bat -p android assembleDebug bundleRelease --no-daemon
```

## Continue later

1. Check Play Console for Google's identity-review result.
2. Complete real-phone device verification using the Play Console app.
3. After the other verification tasks are approved, verify the contact phone
   number in Play Console.
4. Create the `GMCT Connect` app entry after Play Console enables app creation.
   Use English (United States), app (not game), and free as the initial setup
   values unless the owner chooses otherwise.
5. Replace the starter Android launcher icon with approved GMCT artwork and
   confirm the public developer name and support contact.
6. Create and securely back up the Android upload keystore. Do not commit the
   keystore, passwords, or signing secrets to Git. Configure release signing
   locally, then rebuild the signed AAB.
7. Verify app access and location behavior on a real Android phone. The emulator
   smoke test confirmed rendering only; it did not verify Supabase login or
   live attendance sync.
8. Complete Play Console store listing, privacy policy, Data safety, content
   rating, and any other required declarations. Upload the signed AAB to the
   internal testing track and invite testers.
9. For a future production release under this new personal account, complete
   Google's required 12-tester / 14-continuous-day closed test and apply for
   production access.

## References

- [Google Play Console account verification](https://support.google.com/googleplay/android-developer/answer/13628312)
- [Google Play personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Google Play real-device verification](https://support.google.com/googleplay/android-developer/answer/14316361)
- [Google Play testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334)

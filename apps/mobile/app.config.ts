import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Static config lives in app.json; this adds what must come from the environment at build time.
 * Google Maps native keys are restricted to this app (Android package + SHA-1 / iOS bundle id) in
 * Google Cloud and are read here so they never sit in the repo. Locally: apps/mobile/.env.local;
 * EAS: project environment variables. Changing them needs a new native build.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
      },
    ],
  ],
});

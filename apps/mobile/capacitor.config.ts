import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: process.env.MOBILE_APP_ID ?? 'com.example.tugla',
  appName: process.env.APP_NAME ?? 'Tuğla',
  webDir: '../web/out',
  server: process.env.CAPACITOR_SERVER_URL
    ? {
        url: process.env.CAPACITOR_SERVER_URL,
        cleartext: process.env.NODE_ENV !== 'production',
        allowNavigation: [new URL(process.env.CAPACITOR_SERVER_URL).hostname],
      }
    : undefined,
  plugins: {
    SplashScreen: {
      launchShowDuration: 1_500,
      backgroundColor: '#07111fff',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#07111f',
    },
    Keyboard: {
      resize: 'body',
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    backgroundColor: '#07111f',
  },
};

export default config;

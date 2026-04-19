import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.drate.app',
  appName: 'Drate',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    FirebaseAuthentication: {
      providers: ['google.com'],
      skipNativeAuth: true,
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mymuscle.app',
  appName: 'MyMuscle',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tech.domnex.girocerto',
  appName: 'Giro Certo',
  webDir: 'dist',
  backgroundColor: '#090d16',
  android: {
    allowMixedContent: false,
  },
};

export default config;

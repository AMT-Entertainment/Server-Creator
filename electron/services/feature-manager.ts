import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type ConfigValue = string | number | boolean;

interface FeatureDef {
  id: string;
  version: string;
  title: string;
  description: string;
  type: 'info' | 'config';
  configKey?: string;
  defaultValue?: ConfigValue;
  options?: { label: string; value: ConfigValue }[];
}

interface FeatureState {
  acknowledgedFeatures: string[];
  config: Record<string, ConfigValue>;
}

const DATA_DIR = path.join(os.homedir(), '.server-creator');
const STATE_PATH = path.join(DATA_DIR, 'features.json');

const FEATURES: FeatureDef[] = [
  {
    id: 'v140-improvements',
    version: '1.4.0',
    title: 'Type Safety & Quality Improvements',
    description:
      'v1.4.0 removes 90+ unsafe `any` types, adds ESLint + Prettier code formatting, and includes automated testing with Jest. The app is now more stable and easier to develop.',
    type: 'info',
  },
  {
    id: 'tunnel-ssh',
    version: '1.3.0',
    title: 'SSH Tunnel (Pinggy / Serveo)',
    description:
      'Tunneling now uses SSH-based tunnels (Pinggy.io and Serveo.net) instead of Playit.gg. No setup needed — just make sure SSH is installed on your system.',
    type: 'info',
  },
  {
    id: 'auto-start',
    version: '1.2.0',
    title: 'Auto-Start Servers on Boot',
    description: 'You can now configure servers to automatically start when your computer boots up.',
    type: 'config',
    configKey: 'autoStartEnabled',
    defaultValue: false,
  },
  {
    id: 'notifications',
    version: '1.2.0',
    title: 'Desktop Notifications',
    description: 'Server Creator now sends desktop notifications when servers start, stop, or crash.',
    type: 'config',
    configKey: 'notificationsEnabled',
    defaultValue: true,
  },
  {
    id: 'update-channel',
    version: '1.3.0',
    title: 'Update Channel',
    description: 'Choose how often you receive updates. "Stable" only releases, or "Beta" for early access.',
    type: 'config',
    configKey: 'updateChannel',
    defaultValue: 'stable',
    options: [
      { label: 'Stable (recommended)', value: 'stable' },
      { label: 'Beta', value: 'beta' },
    ],
  },
];

export class FeatureManager {
  private state: FeatureState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): FeatureState {
    try {
      if (fs.existsSync(STATE_PATH)) {
        return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
      }
    } catch {}
    return { acknowledgedFeatures: [], config: {} };
  }

  private saveState() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STATE_PATH, JSON.stringify(this.state, null, 2));
    } catch {}
  }

  getNewFeatures(_currentVersion: string): FeatureDef[] {
    const newFeatures: FeatureDef[] = [];
    for (const feature of FEATURES) {
      if (!this.state.acknowledgedFeatures.includes(feature.id)) {
        newFeatures.push(feature);
      }
    }
    return newFeatures;
  }

  acknowledgeFeature(featureId: string) {
    if (!this.state.acknowledgedFeatures.includes(featureId)) {
      this.state.acknowledgedFeatures.push(featureId);
    }
    this.saveState();
  }

  getConfig(key: string, defaultValue?: ConfigValue): ConfigValue | undefined {
    return this.state.config[key] !== undefined ? this.state.config[key] : defaultValue;
  }

  setConfig(key: string, value: ConfigValue) {
    this.state.config[key] = value;
    this.saveState();
  }

  getAllConfig(): Record<string, ConfigValue> {
    return { ...this.state.config };
  }

  getFeatureById(id: string): FeatureDef | undefined {
    return FEATURES.find(f => f.id === id);
  }

  getNextUnacknowledged(currentVersion: string): FeatureDef | null {
    const newFeatures = this.getNewFeatures(currentVersion);
    return newFeatures.length > 0 ? newFeatures[0] : null;
  }
}

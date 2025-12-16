import Conf from 'conf';
import { z } from 'zod';
import { join } from 'path';
import { homedir } from 'os';
import { config as loadEnv } from 'dotenv';

// Load environment variables early
loadEnv();

const configSchema = z.object({
  api: z.object({
    coinmarketcap: z.object({
      apiKey: z.string().default(''),
    }),
    anthropic: z.object({
      apiKey: z.string().default(''),
      model: z.string().default('claude-haiku-4-5'),
    }),
  }),
  database: z.object({
    ledgerPath: z.string().default(join(process.cwd(), 'data', 'ledger.db')),
    ratesPath: z.string().default(join(process.cwd(), 'data', 'rates.db')),
  }),
  defaults: z.object({
    baseCurrency: z.string().default('EUR'),
  }),
  cache: z.object({
    rateCacheTTL: z.number().default(5), // minutes
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

class ConfigManager {
  private conf: Conf<Partial<AppConfig>>;

  constructor() {
    // Store config in project directory instead of home directory
    const configDir = join(process.cwd(), '.config');

    this.conf = new Conf<Partial<AppConfig>>({
      projectName: 'crypto-tracker',
      cwd: configDir,
    });
  }

  get(): AppConfig {
    const config = this.conf.store;

    // Apply defaults and validate
    const defaultConfig: Partial<AppConfig> = {
      database: {
        ledgerPath: join(process.cwd(), 'data', 'ledger.db'),
        ratesPath: join(process.cwd(), 'data', 'rates.db'),
      },
      defaults: {
        baseCurrency: 'EUR',
      },
      cache: {
        rateCacheTTL: 5,
      },
      api: {
        coinmarketcap: {
          apiKey: '',
        },
        anthropic: {
          apiKey: '',
          model: 'claude-haiku-4-5',
        },
      },
    };

    // Merge config with environment variables taking precedence
    const mergedConfig = {
      ...defaultConfig,
      ...config,
      database: { ...defaultConfig.database, ...config.database },
      defaults: { ...defaultConfig.defaults, ...config.defaults },
      cache: { ...defaultConfig.cache, ...config.cache },
      api: {
        coinmarketcap: {
          ...defaultConfig.api?.coinmarketcap,
          ...config.api?.coinmarketcap,
          // Environment variables override config file
          apiKey:
            process.env.CMC_API_KEY ||
            config.api?.coinmarketcap?.apiKey ||
            defaultConfig.api?.coinmarketcap?.apiKey ||
            '',
        },
        anthropic: {
          ...defaultConfig.api?.anthropic,
          ...config.api?.anthropic,
          // Environment variables override config file
          apiKey:
            process.env.ANTHROPIC_API_KEY ||
            config.api?.anthropic?.apiKey ||
            defaultConfig.api?.anthropic?.apiKey ||
            '',
          model:
            config.api?.anthropic?.model ||
            defaultConfig.api?.anthropic?.model ||
            'claude-haiku-4-5',
        },
      },
    };

    // Validate the merged config
    const result = configSchema.safeParse(mergedConfig);

    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    return result.data;
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.conf.set(key, value);
  }

  has(key: keyof AppConfig): boolean {
    return this.conf.has(key);
  }

  delete(key: keyof AppConfig): void {
    this.conf.delete(key);
  }

  clear(): void {
    this.conf.clear();
  }

  getPath(): string {
    return this.conf.path;
  }

  isConfigured(): boolean {
    try {
      const config = this.get();
      return !!(config.api.coinmarketcap.apiKey && config.api.anthropic.apiKey);
    } catch {
      return false;
    }
  }

  initializeDefaults(): void {
    if (!this.has('database')) {
      this.set('database', {
        ledgerPath: join(process.cwd(), 'data', 'ledger.db'),
        ratesPath: join(process.cwd(), 'data', 'rates.db'),
      });
    }

    if (!this.has('defaults')) {
      this.set('defaults', {
        baseCurrency: 'EUR',
      });
    }

    if (!this.has('cache')) {
      this.set('cache', {
        rateCacheTTL: 5,
      });
    }

    if (!this.has('api')) {
      this.set('api', {
        coinmarketcap: {
          apiKey: process.env.CMC_API_KEY || '',
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || '',
          model: 'claude-haiku-4-5',
        },
      });
    }
  }
}

export const configManager = new ConfigManager();

# @voltage/config

Centralized, type-safe configuration management for Voltage application.

## 📁 Structure

```
packages/config/
├── index.ts          # Main configuration export with validation
├── types.ts          # TypeScript type definitions
├── defaults.ts       # Default values for all configuration sections
├── loader.ts         # Environment variable loading logic
├── validators.ts     # Configuration validation rules
└── README.md         # This file
```

## 🚀 Usage

```typescript
import { config } from "@voltage/config";

// Access configuration
console.log(config.api.node_port);
console.log(config.storage.type);
console.log(config.database.type);
```

## 🔒 Environment Variables

Configuration is loaded from environment files in the following order (later files override earlier ones):

1. `.env` - Base configuration
2. `.env.local` - Local overrides (not in git)
3. `.env.{VOLTAGE_ENV}` - Environment-specific (e.g., `.env.production`)

### Example `.env` file:

```env
# Application
VOLTAGE_NAME=VOLTAGE
VOLTAGE_VERSION=1.0.8
VOLTAGE_ENV=local
VOLTAGE_PROTOCOL=http
VOLTAGE_HOST=localhost
VOLTAGE_PORT=8080

# API
VOLTAGE_API_NODE_PORT=4000
VOLTAGE_API_KEY=your-secret-key-here

# Database
VOLTAGE_DATABASE_TYPE=SQLITE
VOLTAGE_DATABASE_FILE_NAME=db.sqlite

# Storage
VOLTAGE_STORAGE_TYPE=LOCAL
VOLTAGE_STORAGE_BASE_PATH=./storage

# For S3-compatible storage:
# VOLTAGE_STORAGE_TYPE=AWS_S3
# VOLTAGE_STORAGE_REGION=us-east-1
# VOLTAGE_STORAGE_BUCKET=my-bucket
# VOLTAGE_STORAGE_ACCESS_KEY=your-access-key
# VOLTAGE_STORAGE_ACCESS_SECRET=your-secret-key
```

## ✅ Validation

Configuration is automatically validated on load. If validation fails, the application will throw a `ConfigValidationError` with a descriptive message.

### Validation Rules:

- **Ports**: Must be integers between 1 and 65535
- **Storage**:
    - S3-compatible types require: `region`, `bucket`, `access_key`, `access_secret`
    - FTP/SFTP types require: `host`, `username`
- **Database**:
    - SQLite requires: `file_name`
    - Other types require: `host`, `name`, `username`
- **Runtime**:
    - `workers.per_cpu_core` must be at least 1
    - Timeout values must be at least 1 second
- **Jobs**:
    - `try_max` must be >= `try_min`
    - Process timeout must be > process interval

## 🔐 Security Notes

**"Tüm secretlar düz env'de" açıklaması:**

- Secrets (API keys, database passwords, storage credentials) `.env` dosyalarında düz metin olarak saklanıyor
- **Production'da şunları kullan:**
    - Docker Secrets
    - Kubernetes Secrets
    - AWS Secrets Manager
    - Azure Key Vault
    - HashiCorp Vault

**Önerilen Production Yapısı:**

```typescript
// Production ortamında env variable'ları secrets manager'dan çek
if (process.env.NODE_ENV === "production") {
	// Secrets Manager'dan oku
	const secrets = await fetchFromSecretsManager();
	process.env.VOLTAGE_DATABASE_PASSWORD = secrets.dbPassword;
	process.env.VOLTAGE_STORAGE_ACCESS_SECRET = secrets.storageSecret;
}
```

## 📝 Type Safety

All configuration is fully typed. Import types when needed:

```typescript
import type { Config, StorageType, DatabaseType } from "@voltage/config";

function processConfig(config: Config) {
	// Full type safety
	const storageType: StorageType = config.storage.type;
	const dbType: DatabaseType = config.database.type;
}
```

## 🛠️ Adding New Configuration

1. **Add type in `types.ts`:**

```typescript
export interface Config {
	// ... existing config
	myNewFeature: {
		enabled: boolean;
		timeout: number;
	};
}
```

2. **Add defaults in `defaults.ts`:**

```typescript
export const MY_FEATURE_DEFAULTS = {
	enabled: false,
	timeout: 5000
} as const;
```

3. **Add to config in `index.ts`:**

```typescript
export const config: Config = {
	// ... existing config
	myNewFeature: {
		enabled: getEnvBoolean("MY_FEATURE_ENABLED", MY_FEATURE_DEFAULTS.enabled),
		timeout: getEnvNumber("MY_FEATURE_TIMEOUT", MY_FEATURE_DEFAULTS.timeout)
	}
};
```

4. **Add validation in `validators.ts` (if needed):**

```typescript
function validateMyFeature(config: Config): void {
	if (config.myNewFeature.timeout < 1000) {
		throw new ConfigValidationError("MY_FEATURE_TIMEOUT must be at least 1000ms");
	}
}
```

## 🔍 Helper Functions

### `getEnv(key, fallback)`

Get string environment variable with fallback.

### `getEnvNumber(key, fallback)`

Get numeric environment variable with fallback. Returns fallback if value is NaN.

### `getEnvBoolean(key, fallback)`

Get boolean environment variable. Considers `"true"` as true, everything else as false.

### `validateConfig(config)`

Validates entire configuration. Throws `ConfigValidationError` on failure.

## 📊 Configuration Sections

| Section    | Purpose             | Key Variables                                                 |
| ---------- | ------------------- | ------------------------------------------------------------- |
| `app`      | Application basics  | `VOLTAGE_NAME`, `VOLTAGE_PORT`, `VOLTAGE_ENV`                 |
| `api`      | API server config   | `VOLTAGE_API_NODE_PORT`, `VOLTAGE_API_KEY`                    |
| `frontend` | Frontend config     | `VOLTAGE_FRONTEND_NODE_PORT`, `VOLTAGE_FRONTEND_PASSWORD`     |
| `database` | Database connection | `VOLTAGE_DATABASE_TYPE`, `VOLTAGE_DATABASE_HOST`              |
| `storage`  | File storage        | `VOLTAGE_STORAGE_TYPE`, `VOLTAGE_STORAGE_BUCKET`              |
| `runtime`  | Worker runtime      | `VOLTAGE_WORKERS_PER_CPU_CORE`, `VOLTAGE_RUNTIME_IS_DISABLED` |
| `jobs`     | Job processing      | `VOLTAGE_JOBS_RETRY_IN`, `VOLTAGE_JOBS_TRY_MAX`               |
| `utils`    | Utilities           | `FFMPEG_PATH`, `NSFW_MODEL`, `WHISPER_MODEL`                  |
| `logs`     | Logging             | `VOLTAGE_LOGS_RETENTION`, `VOLTAGE_LOGS_IS_DISABLED`          |
| `stats`    | Statistics          | `VOLTAGE_STATS_RETENTION`                                     |

## 🎯 Best Practices

1. **Never commit `.env.local`** - Add to `.gitignore`
2. **Use environment-specific files** - `.env.production`, `.env.staging`
3. **Validate early** - Validation runs on import, fail fast
4. **Type everything** - Leverage TypeScript for safety
5. **Document new variables** - Update this README when adding config
6. **Use defaults wisely** - Provide sensible defaults for non-critical values
7. **Secrets management** - Use proper secret managers in production

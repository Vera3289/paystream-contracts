const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { loadSecrets } = require('../services/secretsService');
const { readVaultSecret } = require('../services/vaultService');

function resolveCandidateFiles(environmentName) {
  const names = [
    `.env.${environmentName}.local`,
    `.env.${environmentName}`,
    '.env.local',
    '.env',
  ];

  const cwd = process.cwd();
  const candidates = [];
  for (const name of names) {
    candidates.push(path.resolve(cwd, name));
    candidates.push(path.resolve(cwd, 'api', name));
  }

  return [...new Set(candidates)];
}

function applyParsedEnv(parsedEnv, source) {
  Object.entries(parsedEnv).forEach(([key, value]) => {
    if (typeof value === 'string' && !Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  });

  return source;
}

function loadEnvironmentFiles(environmentName) {
  const candidates = resolveCandidateFiles(environmentName);
  const loaded = [];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const parsed = dotenv.config({ path: candidate, override: false });
      if (!parsed.error) {
        loaded.push(path.relative(process.cwd(), candidate));
      }
    }
  }

  return loaded;
}

async function loadConfiguration() {
  const environmentName = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  const loadedFiles = loadEnvironmentFiles(environmentName);

  if (process.env.USE_AWS_SECRETS_MANAGER === 'true') {
    await loadSecrets();
  }

  if (process.env.USE_VAULT === 'true') {
    const secretPath = process.env.VAULT_SECRET_PATH;
    if (!secretPath) {
      throw new Error('VAULT_SECRET_PATH is required when Vault integration is enabled');
    }
    const vaultSecrets = await readVaultSecret(secretPath);
    Object.entries(vaultSecrets || {}).forEach(([key, value]) => {
      if (typeof value === 'string' && !Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = value;
      }
    });
  }

  return {
    environmentName,
    loadedFiles,
    hasAwsSecrets: process.env.USE_AWS_SECRETS_MANAGER === 'true',
    hasVault: process.env.USE_VAULT === 'true',
  };
}

module.exports = {
  loadConfiguration,
  applyParsedEnv,
  resolveCandidateFiles,
};

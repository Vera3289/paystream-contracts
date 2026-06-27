async function readVaultSecret(secretPath) {
  if (process.env.VAULT_ADDR && process.env.VAULT_TOKEN) {
    return {
      VAULT_SECRET_PATH: secretPath,
      JWT_SECRET: process.env.JWT_SECRET || 'vault-placeholder-secret',
    };
  }

  return {};
}

module.exports = {
  readVaultSecret,
};

import "server-only";

export class EnvConfigurationError extends Error {
  constructor(
    message: string,
    public readonly missingKeys: string[],
  ) {
    super(message);
    this.name = "EnvConfigurationError";
  }
}

export function requireServerEnv(keys: string[]) {
  const missingKeys = keys.filter((key) => !process.env[key]?.trim());

  if (missingKeys.length > 0) {
    throw new EnvConfigurationError(
      `Missing required server environment variables: ${missingKeys.join(", ")}.`,
      missingKeys,
    );
  }

  return Object.fromEntries(keys.map((key) => [key, process.env[key]!.trim()]));
}

export function requiredServerEnv(key: string) {
  return requireServerEnv([key])[key];
}

export function optionalPositiveIntegerEnv(key: string, fallback: number) {
  const value = process.env[key];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function envSetupMessage(error: EnvConfigurationError) {
  return `${error.message} Add them to .env.local before using this route.`;
}

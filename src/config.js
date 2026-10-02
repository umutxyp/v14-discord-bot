'use strict';

const path = require('node:path');

// Load variables from a local `.env` file when one exists (Node.js >= 20.12).
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const env = (key, fallback = '') => process.env[key]?.trim() || fallback;

const toBoolean = (value, fallback) => {
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toList = (value) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const toShardCount = (value) => {
  if (value === 'auto') return 'auto';
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    throw new TypeError(`TOTAL_SHARDS must be "auto" or a positive integer, received "${value}".`);
  }
  return count;
};

const toColor = (value) => {
  const color = Number.parseInt(value.replace(/^#/, ''), 16);
  if (Number.isNaN(color) || color < 0 || color > 0xffffff) {
    throw new TypeError(`ACCENT_COLOR must be a hex color such as #5865F2, received "${value}".`);
  }
  return color;
};

/**
 * Every setting can be provided through environment variables (or a `.env` file).
 * See `.env.example` for a documented list.
 */
module.exports = Object.freeze({
  /** Bot token from https://discord.com/developers/applications */
  token: env('DISCORD_TOKEN', env('TOKEN')),

  prefix: Object.freeze({
    /** Disable to run as a pure slash-command bot (no Message Content intent needed). */
    enabled: toBoolean(env('PREFIX_ENABLED'), true),
    /** Classic prefix, e.g. `!help`. Mentioning the bot (`@Bot help`) always works too. */
    value: env('PREFIX', '!'),
  }),

  /** User IDs that bypass cooldowns and can use `ownerOnly` commands. */
  owners: toList(env('OWNER_IDS')),

  /** Register slash commands to this guild only (instant updates while developing). */
  devGuildId: env('DEV_GUILD_ID') || null,

  /** Sync slash commands with Discord every time the bot starts. */
  deployOnStart: toBoolean(env('DEPLOY_ON_START'), true),

  /** "auto" lets Discord recommend the shard count. */
  totalShards: toShardCount(env('TOTAL_SHARDS', 'auto')),

  /** Optional HTTP health-check port (useful for Render, Railway, Replit, uptime monitors...). */
  port: env('PORT') ? Number(env('PORT')) : null,

  /** Text shown as the bot's custom status. */
  status: env('BOT_STATUS', 'Umut Bayraktar ♥ /help'),

  /** Accent color used on every Components V2 container. */
  accentColor: toColor(env('ACCENT_COLOR', '#5865F2')),

  /** Default per-user cooldown in seconds for commands that do not set their own. */
  defaultCooldown: 3,
});

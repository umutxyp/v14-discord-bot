'use strict';

const { ActivityType, Client, Collection, GatewayIntentBits, Options, Partials } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const { fatal } = require('./utils/fatal');
const { loadCommands, loadEvents } = require('./utils/loader');

/**
 * One shard process. Started by the ShardingManager in `src/index.js`
 * (or directly with `npm run dev` for small bots / local development).
 */
const client = new Client({
  // Only request what the bot actually uses. Prefix commands need the privileged Message Content intent.
  intents: [
    GatewayIntentBits.Guilds,
    ...(config.prefix.enabled ? [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] : []),
  ],
  partials: [Partials.Channel],
  allowedMentions: { parse: [], repliedUser: false },
  presence: {
    status: 'online',
    activities: [{ name: config.status, type: ActivityType.Custom }],
  },
  // Keep memory usage predictable on large bots.
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 100,
    ReactionManager: 0,
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 3_600, lifetime: 1_800 },
  },
});

const { commands, aliases } = loadCommands();
client.commands = commands;
client.aliases = aliases;
/** @type {Collection<string, number>} `<command>:<userId>` → timestamp when the cooldown ends. */
client.cooldowns = new Collection();

loadEvents(client);

client.on('error', (error) => logger.error('Client error:', error));
client.on('warn', (message) => logger.warn(message));

process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection:', reason));
process.on('uncaughtException', (error) => logger.error('Uncaught exception:', error));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await client.destroy().catch(() => null);
    process.exit(0);
  });
}

if (!config.token) {
  fatal('DISCORD_TOKEN is missing. Copy .env.example to .env and paste your bot token.');
} else {
  client.login(config.token).catch((error) => {
    if (error.code === 'TokenInvalid' || error.status === 401) {
      return fatal('Login failed: the bot token is invalid. Check DISCORD_TOKEN in your .env file.');
    }
    // Temporary problems (network, Discord outage): exit after a short pause so the
    // ShardingManager respawns this shard without hammering the API.
    logger.error(`Login failed${error.status ? ` (HTTP ${error.status})` : ''}: ${error.message} — retrying in 10s.`);
    setTimeout(() => process.exit(1), 10_000);
  });
}

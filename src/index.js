'use strict';

const http = require('node:http');
const path = require('node:path');
const { ApplicationFlagsBitField, REST, Routes, ShardingManager } = require('discord.js');
const config = require('./config');
const { deployCommands } = require('./deploy');
const { createLogger } = require('./utils/logger');
const { FATAL_MESSAGE } = require('./utils/fatal');

const logger = createLogger('Manager');

const manager = new ShardingManager(path.join(__dirname, 'bot.js'), {
  token: config.token,
  totalShards: config.totalShards,
  respawn: true,
});

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down all shards...');
  for (const shard of manager.shards.values()) shard.kill();
  process.exit(code);
}

manager.on('shardCreate', (shard) => {
  logger.info(`Launching shard ${shard.id}...`);
  shard.on('ready', () => logger.success(`Shard ${shard.id} is ready.`));
  shard.on('reconnecting', () => logger.warn(`Shard ${shard.id} is reconnecting...`));
  shard.on('death', () => !shuttingDown && logger.warn(`Shard ${shard.id} died, respawning...`));
  shard.on('error', (error) => logger.error(`Shard ${shard.id} error:`, error));
  shard.on('message', (message) => {
    if (message?.type === FATAL_MESSAGE) {
      logger.error(`Shard ${shard.id} hit a fatal error, stopping the bot.`);
      shutdown(1);
    }
  });
});

/** Optional health endpoint for hosting platforms and uptime monitors. */
function startHealthServer() {
  const server = http.createServer((request, response) => {
    const shards = [...manager.shards.values()].map((shard) => ({ id: shard.id, ready: shard.ready }));
    const healthy = shards.length > 0 && shards.every((shard) => shard.ready);
    response.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: healthy ? 'ok' : 'starting', shards }));
  });
  server.listen(config.port, () => logger.info(`Health check listening on port ${config.port}.`));
}

async function main() {
  if (!config.token) {
    logger.error('DISCORD_TOKEN is missing. Copy .env.example to .env and paste your bot token.');
    process.exit(1);
  }

  // Validate the token and intents once here, so shards don't crash-loop with a bad setup.
  const rest = new REST().setToken(config.token);
  const application = await rest.get(Routes.currentApplication()).catch((error) => {
    if (error.status === 401) throw new Error('The bot token is invalid. Check DISCORD_TOKEN in your .env file.');
    throw new Error(`Could not reach the Discord API (${error.status ? `HTTP ${error.status}` : error.code}): ${error.message}`);
  });

  const flags = new ApplicationFlagsBitField(application.flags ?? 0);
  if (config.prefix.enabled && !flags.any(['GatewayMessageContent', 'GatewayMessageContentLimited'])) {
    throw new Error(
      'Prefix commands need the "Message Content Intent". Enable it in the Developer Portal → Bot → Privileged Gateway Intents, or set PREFIX_ENABLED=false.',
    );
  }

  if (config.deployOnStart) await deployCommands({ rest, applicationId: application.id });
  if (config.port) startHealthServer();

  // `timeout: -1` never rejects on slow shards (large bots); each shard logs when it is ready.
  await manager.spawn({ timeout: -1 });
  logger.info(`Launched ${manager.totalShards} shard process(es).`);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => shutdown(0));

main().catch((error) => {
  logger.error(`Startup failed: ${error.message}`);
  shutdown(1);
});

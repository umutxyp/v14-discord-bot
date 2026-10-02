'use strict';

const { Events, GatewayCloseCodes } = require('discord.js');
const logger = require('../utils/logger');
const { fatal } = require('../utils/fatal');

const HINTS = {
  [GatewayCloseCodes.AuthenticationFailed]:
    'The bot token is invalid. Reset it in the Developer Portal and update DISCORD_TOKEN.',
  [GatewayCloseCodes.DisallowedIntents]:
    'Privileged intents are disabled. Enable "Message Content Intent" in the Developer Portal → Bot, or set PREFIX_ENABLED=false.',
  [GatewayCloseCodes.InvalidIntents]: 'The requested intents are invalid.',
  [GatewayCloseCodes.ShardingRequired]:
    'Discord requires sharding. Start the bot with "npm start" instead of running bot.js directly.',
};

module.exports = {
  name: Events.ShardDisconnect,
  /**
   * Emitted only when a shard disconnects and will NOT reconnect on its own.
   * @param {import('discord.js').CloseEvent} event
   * @param {number} shardId
   */
  async execute(event, shardId) {
    const hint = HINTS[event.code];
    if (hint) return fatal(`Gateway closed with code ${event.code}. ${hint}`);
    logger.warn(`Shard ${shardId} disconnected permanently (code ${event.code}).`);
  },
};

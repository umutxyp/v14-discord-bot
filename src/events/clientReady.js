'use strict';

const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  /** @param {import('discord.js').Client<true>} client */
  async execute(client) {
    const shards = client.shard ? `shard(s) ${client.shard.ids.join(', ')} of ${client.shard.count}` : 'no sharding';
    logger.success(`Logged in as ${client.user.tag} — ${client.guilds.cache.size} guilds on ${shards}.`);
  },
};

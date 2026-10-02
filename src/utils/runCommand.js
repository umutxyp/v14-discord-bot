'use strict';

const config = require('../config');
const logger = require('./logger');
const ui = require('./ui');
const UsageError = require('../structures/UsageError');
const { formatUsage } = require('./usage');
const { missingPermissions } = require('./permissions');

/** Replies without ever throwing (the original interaction may have expired). */
const safeReply = (ctx, options) =>
  ctx.reply(options).catch((error) => logger.warn(`Could not send a reply for "${ctx.command.data.name}":`, error.message));

/**
 * Applies the cooldown and returns the timestamp at which the user may run the command again,
 * or `null` when the command can run right now.
 * @param {import('discord.js').Client} client
 * @param {import('./loader').Command} command
 * @param {string} userId
 */
function consumeCooldown(client, command, userId) {
  const seconds = command.cooldown ?? config.defaultCooldown;
  if (!seconds || config.owners.includes(userId)) return null;

  const key = `${command.data.name}:${userId}`;
  const now = Date.now();
  const expiresAt = client.cooldowns.get(key);
  if (expiresAt && expiresAt > now) return expiresAt;

  client.cooldowns.set(key, now + seconds * 1000);
  setTimeout(() => client.cooldowns.delete(key), seconds * 1000).unref();
  return null;
}

/**
 * Runs a command for either a slash interaction or a prefix message.
 * Handles owner checks, permissions, argument parsing, cooldowns and errors in one place.
 * @param {import('./loader').Command} command
 * @param {import('../structures/CommandContext')} ctx
 */
async function runCommand(command, ctx) {
  if (command.ownerOnly && !config.owners.includes(ctx.user.id)) {
    return safeReply(ctx, ui.error('This command can only be used by the bot owners.', { title: '🔒 Owner only' }));
  }

  const missingUser = missingPermissions(ctx.memberPermissions, command.permissions?.user);
  if (missingUser.length) {
    return safeReply(
      ctx,
      ui.error(`You need the following permissions: **${missingUser.join(', ')}**`, { title: '🚫 Missing permissions' }),
    );
  }

  const missingBot = missingPermissions(ctx.appPermissions, command.permissions?.bot);
  if (missingBot.length) {
    return safeReply(
      ctx,
      ui.error(`I need the following permissions: **${missingBot.join(', ')}**`, { title: '🚫 Missing permissions' }),
    );
  }

  try {
    await ctx.resolveOptions();

    const retryAt = consumeCooldown(ctx.client, command, ctx.user.id);
    if (retryAt) {
      return await safeReply(
        ctx,
        ui.warning(`You can use \`${command.data.name}\` again ${ui.timestamp(retryAt)}.`, { title: '⏳ Slow down' }),
      );
    }

    await command.execute(ctx);
  } catch (error) {
    if (error instanceof UsageError) {
      const usage = formatUsage(command, ctx.prefix)
        .map((line) => `\`${line}\``)
        .join('\n');
      return safeReply(ctx, ui.error(`${error.message}\n\n**Usage**\n${usage}`, { title: '❔ Invalid usage' }));
    }

    logger.error(`Command "${command.data.name}" failed (${ctx.isInteraction() ? 'slash' : 'prefix'}):`, error);
    return safeReply(ctx, ui.error('An unexpected error occurred while running this command. Please try again later.'));
  }
}

module.exports = { runCommand };

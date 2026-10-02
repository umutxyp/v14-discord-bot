'use strict';

const { ContainerBuilder, MessageFlags, SeparatorSpacingSize } = require('discord.js');
const config = require('../config');

const Colors = Object.freeze({
  brand: config.accentColor,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
});

/**
 * Starts a Components V2 container with the given accent color.
 * @param {number} [color]
 */
const container = (color = Colors.brand) => new ContainerBuilder().setAccentColor(color);

/**
 * Wraps top-level components into a Components V2 message payload.
 * `content` and `embeds` cannot be used together with the IsComponentsV2 flag.
 * The Ephemeral flag is honoured by interactions and stripped for prefix commands.
 * @param {import('discord.js').JSONEncodable<unknown>[]} components
 * @param {{ ephemeral?: boolean }} [options]
 */
const payload = (components, { ephemeral = false } = {}) => ({
  components,
  flags: ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2,
  allowedMentions: { parse: [], repliedUser: false },
});

/** Adds a thin divider to a container. */
const divider = (builder, spacing = SeparatorSpacingSize.Small) =>
  builder.addSeparatorComponents((separator) => separator.setDivider(true).setSpacing(spacing));

const notice = (color, title, description, ephemeral) =>
  payload([container(color).addTextDisplayComponents((text) => text.setContent(`### ${title}\n${description}`))], {
    ephemeral,
  });

const error = (description, { ephemeral = true, title = '❌ Something went wrong' } = {}) =>
  notice(Colors.danger, title, description, ephemeral);

const warning = (description, { ephemeral = true, title = '⚠️ Hold on' } = {}) =>
  notice(Colors.warning, title, description, ephemeral);

const success = (description, { ephemeral = false, title = '✅ Done' } = {}) =>
  notice(Colors.success, title, description, ephemeral);

/** Discord timestamp markdown, e.g. `<t:1700000000:R>`. */
const timestamp = (date, style = 'R') => `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`;

/** Human readable duration, e.g. `3d 4h 12m 5s`. */
const duration = (ms) => {
  const units = [
    ['d', 86_400_000],
    ['h', 3_600_000],
    ['m', 60_000],
    ['s', 1_000],
  ];
  const parts = [];
  for (const [label, size] of units) {
    const value = Math.floor(ms / size);
    ms %= size;
    if (value) parts.push(`${value}${label}`);
  }
  return parts.join(' ') || '0s';
};

/** Formats bytes as MB with one decimal. */
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

module.exports = { Colors, container, payload, divider, error, warning, success, timestamp, duration, megabytes };

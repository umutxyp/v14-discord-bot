'use strict';

const { ApplicationCommandOptionType: OptionType } = require('discord.js');
const UsageError = require('./UsageError');

const SNOWFLAKE = /^\d{17,20}$/;
const TRUTHY = new Set(['true', 'yes', 'y', 'on', '1', 'evet']);
const FALSY = new Set(['false', 'no', 'n', 'off', '0', 'hayir', 'hayır']);

/**
 * Splits raw message content into arguments, keeping "quoted text" together.
 * @param {string} content
 * @returns {string[]}
 */
function tokenize(content) {
  return [...content.matchAll(/"([^"]*)"|(\S+)/g)].map(([, quoted, word]) => quoted ?? word);
}

const snowflakeFrom = (raw, pattern) => raw.match(pattern)?.[1] ?? (SNOWFLAKE.test(raw) ? raw : null);

/**
 * Parses prefix-command arguments using the command's slash-command option definitions,
 * and exposes the same getters as `CommandInteractionOptionResolver` (`getUser`, `getString`, ...).
 * This lets a single `execute(ctx)` function serve both `/command` and `!command`.
 */
class PrefixOptionResolver {
  constructor() {
    /** @type {Map<string, { name: string, type: OptionType, value?: unknown, user?: import('discord.js').User, member?: import('discord.js').GuildMember | null, channel?: import('discord.js').GuildBasedChannel, role?: import('discord.js').Role, attachment?: import('discord.js').Attachment }>} */
    this.resolved = new Map();
    /** @type {string | null} */
    this.subcommand = null;
    /** @type {string | null} */
    this.group = null;
  }

  /**
   * @param {import('discord.js').Message<true>} message
   * @param {string[]} args
   * @param {import('discord.js').RESTPostAPIChatInputApplicationCommandsJSONBody} data
   */
  static async resolve(message, args, data) {
    const resolver = new PrefixOptionResolver();
    const queue = [...args];
    let options = data.options ?? [];

    const pickBranch = (types, label) => {
      const branches = options.filter((option) => types.includes(option.type));
      if (!branches.length) return null;
      const name = queue.shift()?.toLowerCase();
      const branch = branches.find((option) => option.name === name);
      if (!branch) {
        throw new UsageError(`Please choose a ${label}: ${branches.map((option) => `\`${option.name}\``).join(', ')}.`);
      }
      options = branch.options ?? [];
      return branch.name;
    };

    resolver.group = pickBranch([OptionType.SubcommandGroup, OptionType.Subcommand], 'subcommand');
    if (resolver.group && options.some((option) => option.type === OptionType.Subcommand)) {
      resolver.subcommand = pickBranch([OptionType.Subcommand], 'subcommand');
    } else {
      [resolver.subcommand, resolver.group] = [resolver.group, null];
    }

    const attachments = [...message.attachments.values()];

    for (const [index, option] of options.entries()) {
      if (option.type === OptionType.Attachment) {
        const attachment = attachments.shift();
        if (attachment) resolver.resolved.set(option.name, { name: option.name, type: option.type, attachment });
        else if (option.required) throw new UsageError(`Please attach a file for **${option.name}**.`);
        continue;
      }

      if (!queue.length) {
        if (option.required) throw new UsageError(`Missing required argument **${option.name}**.`);
        continue;
      }

      // The last string option swallows the rest of the message, e.g. `!say hello world`.
      const isLast = index === options.length - 1;
      const raw = option.type === OptionType.String && isLast ? queue.splice(0).join(' ') : queue.shift();
      resolver.resolved.set(option.name, await PrefixOptionResolver.parse(message, option, raw));
    }

    return resolver;
  }

  /**
   * Converts a single raw argument into a typed option value.
   * @param {import('discord.js').Message<true>} message
   * @param {import('discord.js').APIApplicationCommandBasicOption} option
   * @param {string} raw
   */
  static async parse(message, option, raw) {
    const { guild } = message;
    const base = { name: option.name, type: option.type };
    const invalid = (expected) => new UsageError(`\`${raw}\` is not a valid ${expected} for **${option.name}**.`);

    const fromChoices = () => {
      if (!option.choices?.length) return undefined;
      const lowered = raw.toLowerCase();
      const choice = option.choices.find((c) => c.name.toLowerCase() === lowered || String(c.value).toLowerCase() === lowered);
      if (!choice) {
        throw new UsageError(`**${option.name}** must be one of: ${option.choices.map((c) => `\`${c.name}\``).join(', ')}.`);
      }
      return choice.value;
    };

    const checkRange = (value) => {
      if (option.min_value !== undefined && value < option.min_value) {
        throw new UsageError(`**${option.name}** must be at least ${option.min_value}.`);
      }
      if (option.max_value !== undefined && value > option.max_value) {
        throw new UsageError(`**${option.name}** must be at most ${option.max_value}.`);
      }
      return value;
    };

    switch (option.type) {
      case OptionType.String: {
        const value = fromChoices() ?? raw;
        if (option.min_length !== undefined && value.length < option.min_length) {
          throw new UsageError(`**${option.name}** must be at least ${option.min_length} characters.`);
        }
        if (option.max_length !== undefined && value.length > option.max_length) {
          throw new UsageError(`**${option.name}** must be at most ${option.max_length} characters.`);
        }
        return { ...base, value };
      }

      case OptionType.Integer: {
        const choice = fromChoices();
        if (choice !== undefined) return { ...base, value: choice };
        if (!/^-?\d+$/.test(raw)) throw invalid('whole number');
        return { ...base, value: checkRange(Number.parseInt(raw, 10)) };
      }

      case OptionType.Number: {
        const choice = fromChoices();
        if (choice !== undefined) return { ...base, value: choice };
        const value = Number(raw.replace(',', '.'));
        if (!Number.isFinite(value)) throw invalid('number');
        return { ...base, value: checkRange(value) };
      }

      case OptionType.Boolean: {
        const lowered = raw.toLowerCase();
        if (TRUTHY.has(lowered)) return { ...base, value: true };
        if (FALSY.has(lowered)) return { ...base, value: false };
        throw invalid('yes/no value');
      }

      case OptionType.User: {
        const resolved = await PrefixOptionResolver.findUser(message, raw);
        if (!resolved) throw invalid('user');
        return { ...base, ...resolved };
      }

      case OptionType.Channel: {
        const id = snowflakeFrom(raw, /^<#(\d{17,20})>$/);
        const lowered = raw.replace(/^#/, '').toLowerCase();
        const channel = id
          ? (guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null)))
          : guild.channels.cache.find((c) => c.name.toLowerCase() === lowered);
        if (!channel || (option.channel_types?.length && !option.channel_types.includes(channel.type))) {
          throw invalid('channel');
        }
        return { ...base, channel };
      }

      case OptionType.Role: {
        const role = PrefixOptionResolver.findRole(guild, raw);
        if (!role) throw invalid('role');
        return { ...base, role };
      }

      case OptionType.Mentionable: {
        const role = PrefixOptionResolver.findRole(guild, raw);
        if (role) return { ...base, role };
        const resolved = await PrefixOptionResolver.findUser(message, raw);
        if (!resolved) throw invalid('user or role');
        return { ...base, ...resolved };
      }

      default:
        throw new UsageError(`Option **${option.name}** is not supported as a prefix argument.`);
    }
  }

  /**
   * Resolves a user from a mention, an ID or an (exact) cached username / display name.
   * @param {import('discord.js').Message<true>} message
   * @param {string} raw
   */
  static async findUser(message, raw) {
    const { guild, client } = message;
    const id = snowflakeFrom(raw, /^<@!?(\d{17,20})>$/);

    if (id) {
      const user = await client.users.fetch(id).catch(() => null);
      if (!user) return null;
      const member = guild.members.cache.get(id) ?? (await guild.members.fetch(id).catch(() => null));
      return { user, member };
    }

    const lowered = raw.toLowerCase();
    const member = guild.members.cache.find(
      (m) => m.user.username.toLowerCase() === lowered || m.displayName.toLowerCase() === lowered,
    );
    return member ? { user: member.user, member } : null;
  }

  /**
   * @param {import('discord.js').Guild} guild
   * @param {string} raw
   */
  static findRole(guild, raw) {
    const id = snowflakeFrom(raw, /^<@&(\d{17,20})>$/);
    if (id) return guild.roles.cache.get(id) ?? null;
    const lowered = raw.replace(/^@/, '').toLowerCase();
    return guild.roles.cache.find((role) => role.name.toLowerCase() === lowered) ?? null;
  }

  #get(name, required) {
    const option = this.resolved.get(name);
    if (!option && required) throw new UsageError(`Missing required argument **${name}**.`);
    return option ?? null;
  }

  getSubcommand(required = true) {
    if (!this.subcommand && required) throw new UsageError('A subcommand is required.');
    return this.subcommand;
  }

  getSubcommandGroup(required = false) {
    if (!this.group && required) throw new UsageError('A subcommand group is required.');
    return this.group;
  }

  getString(name, required = false) {
    return this.#get(name, required)?.value ?? null;
  }

  getInteger(name, required = false) {
    return this.#get(name, required)?.value ?? null;
  }

  getNumber(name, required = false) {
    return this.#get(name, required)?.value ?? null;
  }

  getBoolean(name, required = false) {
    return this.#get(name, required)?.value ?? null;
  }

  getUser(name, required = false) {
    return this.#get(name, required)?.user ?? null;
  }

  getMember(name) {
    return this.#get(name, false)?.member ?? null;
  }

  getChannel(name, required = false) {
    return this.#get(name, required)?.channel ?? null;
  }

  getRole(name, required = false) {
    return this.#get(name, required)?.role ?? null;
  }

  getMentionable(name, required = false) {
    const option = this.#get(name, required);
    return option?.member ?? option?.user ?? option?.role ?? null;
  }

  getAttachment(name, required = false) {
    return this.#get(name, required)?.attachment ?? null;
  }
}

module.exports = PrefixOptionResolver;
module.exports.tokenize = tokenize;

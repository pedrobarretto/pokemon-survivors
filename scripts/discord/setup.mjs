// Builds the community Discord server from the spec below, through the bot.
// Idempotent: roles, channels and the bot's own pinned texts are matched by
// name and updated in place, so editing the spec and running it again is safe.
//
//   node --env-file=.env.local scripts/discord/setup.mjs
//
// Needs DISCORD_BOT_TOKEN and DISCORD_GUILD_ID. The bot must be in the server
// with Administrator (the invite link is printed when it isn't), and ffmpeg
// (for the starter emojis).

import { execFileSync } from 'node:child_process'
import { REGIONS, STARTERS } from '../../src/data/starters.ts'
import { TYPE_COLORS } from '../../src/data/types.ts'

/**
 * The introduction gate: when on, only Trainers talk, and a newcomer earns the
 * role by posting in #introductions. Everyone still sees every public channel,
 * because Onboarding's default channels must be visible to @everyone. Keep it
 * off until the bot that hands out Trainer is running, or nobody gets past it.
 */
const GATE = true

const TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD = process.env.DISCORD_GUILD_ID
if (!TOKEN || !GUILD) throw new Error('Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID')

const SITE = 'https://www.pokemonsurvivors.com'
const API = 'https://discord.com/api/v10'

// Permission bits (https://discord.com/developers/docs/topics/permissions).
const P = {
  kick: 1n << 1n,
  ban: 1n << 2n,
  addReactions: 1n << 6n,
  stream: 1n << 9n,
  viewChannel: 1n << 10n,
  sendMessages: 1n << 11n,
  manageEmojis: 1n << 30n,
  manageMessages: 1n << 13n,
  mentionEveryone: 1n << 17n,
  connect: 1n << 20n,
  speak: 1n << 21n,
  muteMembers: 1n << 22n,
  moveMembers: 1n << 24n,
  manageNicknames: 1n << 27n,
  manageThreads: 1n << 34n,
  createPublicThreads: 1n << 35n,
  createPrivateThreads: 1n << 36n,
  sendMessagesInThreads: 1n << 38n,
  moderateMembers: 1n << 40n,
  useSoundboard: 1n << 42n,
}
const MODERATE =
  P.kick | P.ban | P.manageMessages | P.mentionEveryone | P.muteMembers | P.moveMembers | P.manageNicknames | P.manageThreads | P.moderateMembers
const TALK = P.sendMessages | P.createPublicThreads | P.createPrivateThreads | P.sendMessagesInThreads

// Behind the gate a newcomer only listens: no camera, screen share or soundboard either.
const VOICE = P.connect | P.speak | P.stream | P.useSoundboard

const TYPE = { text: 0, voice: 2, category: 4, news: 5, forum: 15 }

/** The 27 starters in region order, each with its main type. */
const STARTER_PICKS = REGIONS.flatMap((region) =>
  region.starters.map((id) => ({ id, name: STARTERS[id].name, dex: STARTERS[id].line[0].dex, type: STARTERS[id].line[0].types[0] })),
)
const capitalize = (word) => word[0].toUpperCase() + word.slice(1)

/** The starters' three types as teams, each shown with its Kanto starter's face. */
const TEAMS = ['grass', 'fire', 'water'].map((type) => {
  const starters = STARTER_PICKS.filter((s) => s.type === type)
  return {
    role: `Team ${capitalize(type)}`,
    title: capitalize(type),
    description: `${starters.slice(0, 3).map((s) => s.name).join(', ')} and friends`,
    face: starters[0].id,
    color: parseInt(TYPE_COLORS[type].slice(1), 16),
  }
})

// Top of the list first. `staff` roles see the staff and supporter channels.
const ROLES = [
  { name: 'Dev', color: 0xf8d030, hoist: true, staff: true },
  { name: 'Moderator', color: 0x6890f0, hoist: true, staff: true },
  { name: 'Gold Supporter', color: 0xf0b000, hoist: true, supporter: true },
  { name: 'Supporter', color: 0xf85888, hoist: true, supporter: true },
  // Picked in Onboarding: the member's name takes the type's color.
  ...TEAMS.map((t) => ({ name: t.role, color: t.color })),
  { name: 'Trainer', color: 0, trainer: true },
  { name: 'Patch Notes Ping', color: 0 },
  { name: 'Daily Challenge Ping', color: 0 },
  { name: 'Events Ping', color: 0 },
]

// `readOnly`: only staff and the bot post. `access`: who can see it (default everyone).
// `optIn`: hidden from the sidebar until picked in Onboarding (the language rooms).
// `aliases`: old names to rename from.
const LAYOUT = [
  {
    category: '👋 Start Here',
    channels: [
      { name: 'welcome', readOnly: true, topic: 'Start here: what the game is and where everything lives.' },
      { name: 'rules', readOnly: true, topic: 'Read before posting.' },
      {
        name: 'introductions',
        open: true,
        slowmode: 30,
        topic: 'Say hi! Your name or nick, where you’re from, your favorite Pokémon and how you found the game.',
      },
      { name: 'announcements', type: 'news', readOnly: true, topic: 'Big news, events and giveaways.' },
      { name: 'patch-notes', type: 'news', readOnly: true, topic: `Every update, posted automatically. Full history: ${SITE}/en/changelog/` },
    ],
  },
  {
    category: '💬 Community',
    channels: [
      { name: 'general', aliases: ['geral'], topic: 'Talk about anything Pokémon Survivors. English, please — other languages have their own rooms.' },
      { name: 'screenshots-and-clips', topic: 'Crazy runs, huge hordes, funny deaths.' },
      { name: 'memes' },
      { name: 'off-topic', topic: 'Anything that is not the game.' },
    ],
  },
  {
    category: '🎮 Game',
    channels: [
      { name: 'daily-challenge', topic: 'Same seed for everyone, one official try a day. Post your time and build. Yesterday’s podium lands here.' },
      { name: 'daily-outbreak', topic: 'Today’s outbreak: which Pokémon is everywhere and how to farm it.' },
      { name: 'shiny-showcase', topic: 'Show off your shinies ✨' },
      {
        name: 'tiktok-reward',
        slowmode: 60,
        topic: 'Follow us on TikTok (@pokemonsurvivors), post a screenshot that shows it with your in-game @handle, and a Dev sends you a rare egg.',
      },
      {
        name: 'creators',
        slowmode: 60,
        topic: `Stream or make videos of the game? Post your channel here to be featured in the lobby and on ${SITE}/en/creators/. The bot posts here when a creator goes live 🔴`,
      },
      {
        name: 'builds-and-strategy',
        type: 'forum',
        topic: 'One post per build or question. Tag the starter type and what it is about.',
        tags: ['Build', 'Question', 'Guide', 'Boss', 'Endless', 'Daily Challenge', 'Mega Evolution'],
      },
    ],
  },
  {
    category: '🛠️ Feedback',
    channels: [
      {
        name: 'bug-reports',
        type: 'forum',
        topic: 'One post per bug. Say what happened, what you expected, your device (phone or PC, browser) and add a screenshot or clip if you can.',
        tags: ['Open', 'Fixed', 'Can’t Reproduce', 'Mobile', 'Desktop', 'Crash', 'Account / Sync'],
      },
      {
        name: 'suggestions',
        type: 'forum',
        topic: 'One idea per post. Vote with reactions. Ideas also live in the game, on the Ideas board.',
        tags: ['Gameplay', 'Pokémon', 'Moves', 'Bosses', 'UI', 'Planned', 'Shipped', 'Declined'],
      },
    ],
  },
  {
    category: '🌎 International',
    channels: [
      { name: 'português', optIn: true, topic: 'Papo em português 🇧🇷🇵🇹' },
      { name: 'español', optIn: true, topic: 'Charla en español 🇪🇸🇲🇽🇦🇷' },
      { name: 'français', optIn: true, topic: 'Discussion en français 🇫🇷' },
      { name: 'deutsch', optIn: true, topic: 'Unterhaltung auf Deutsch 🇩🇪' },
      { name: 'italiano', optIn: true, topic: 'Chiacchiere in italiano 🇮🇹' },
      { name: 'other-languages', optIn: true, topic: 'Any other language 🌐' },
    ],
  },
  {
    category: '💛 Supporters',
    access: 'supporters',
    channels: [
      { name: 'supporters-lounge', topic: `Thank you for keeping the game alive 💛 Become a supporter: ${SITE}/en/support/` },
      { name: 'Supporters Voice', type: 'voice' },
    ],
  },
  {
    category: '🔊 Voice',
    channels: [
      { name: 'General', type: 'voice', aliases: ['Geral'] },
      { name: 'Playing Together', type: 'voice' },
    ],
  },
  {
    category: '🔒 Staff',
    access: 'staff',
    channels: [
      { name: 'mod-chat' },
      { name: 'mod-log', topic: 'Discord’s own community updates and safety alerts.' },
    ],
  },
]

const LANGUAGES = [
  ['português', 'Português', '🇧🇷'],
  ['español', 'Español', '🇪🇸'],
  ['français', 'Français', '🇫🇷'],
  ['deutsch', 'Deutsch', '🇩🇪'],
  ['italiano', 'Italiano', '🇮🇹'],
  ['other-languages', 'Other languages', '🌐'],
]

const PINGS = [
  ['Patch Notes Ping', 'Patch notes', 'Get pinged when an update ships', '🆕'],
  ['Daily Challenge Ping', 'Daily Challenge', 'Get pinged when a new challenge and yesterday’s podium are out', '🏆'],
  ['Events Ping', 'Events', 'Community events, tournaments and giveaways', '🎉'],
]

const WELCOME = {
  title: 'Welcome to Pokémon Survivors!',
  color: 0xf8d030,
  description: [
    `A free, browser **survivors-like with Pokémon**: pick a starter, survive the horde, evolve, learn moves and beat the legendaries. Plays on PC and phone, no install.`,
    '',
    `🎮 **Play:** ${SITE}/en/`,
    `📖 **Guide:** ${SITE}/en/guide/`,
    `📚 **Pokédex:** ${SITE}/en/pokedex/`,
    `🆕 **Changelog:** ${SITE}/en/changelog/`,
    `💛 **Support the game:** ${SITE}/en/support/`,
    `🎥 **Creators:** ${SITE}/en/creators/`,
    '',
    '**Where to go**',
    '📜 Read <#rules> first',
    GATE ? '👋 Introduce yourself in <#introductions> to unlock chatting everywhere' : '👋 Say hi in <#introductions>',
    '🗣️ Change your starter, languages and pings in **Channels & Roles** (top of the channel list)',
    '💬 Hang out in <#general>',
    '🎁 Follow us on TikTok for a free rare egg: <#tiktok-reward>',
    '🎥 Stream or make videos of the game? Get featured: <#creators>',
    '🏆 Post your Daily Challenge time in <#daily-challenge>',
    '🐛 Found a bug? <#bug-reports>',
    '💡 Have an idea? <#suggestions>',
    '',
    'This server speaks **English**. Other languages have their own rooms under 🌎 International.',
  ].join('\n'),
}

// The TikTok reward is checked and sent by hand from the game's admin panel (Painel admin: egg, rare).
const TIKTOK_REWARD = {
  title: '🎁 A rare egg for following us on TikTok',
  color: 0xfe2c55,
  description: [
    '**1.** Follow **@pokemonsurvivors** on TikTok: https://www.tiktok.com/@pokemonsurvivors',
    '**2.** Post a screenshot here that shows you follow us, with your in-game **@handle** (it’s on your Trainer Card).',
    '**3.** A Dev sends you a **rare egg** as a Mystery Gift. Open it from the gift box in the lobby.',
    '',
    'You need a game account: sign in from the lobby (guests can’t get gifts). One egg per account. Gifts go out by hand, so give us a little time.',
  ].join('\n'),
}

const RULES = {
  title: 'Rules',
  color: 0xf08030,
  description: [
    '**1. Be kind.** No harassment, hate speech, slurs or personal attacks.',
    '**2. English in the main channels.** Other languages live in 🌎 International.',
    '**3. No spam or self-promotion.** No ads, invite links or referral spam. Sharing your own fan art and clips is welcome.',
    '**4. Keep it safe for everyone.** No NSFW, gore or shocking content.',
    '**5. No cheating talk.** Don’t share exploits for ranked runs or the Daily Challenge. Found one? Report it privately to a Dev — that helps everyone.',
    '**6. Use the right place.** Bugs in <#bug-reports>, ideas in <#suggestions>, builds in <#builds-and-strategy>.',
    '**7. No piracy or leaks.** Don’t share ROMs or leaked material.',
    '**8. Follow Discord’s rules.** https://discord.com/terms and https://discord.com/guidelines',
    '',
    'Moderators may remove anything that breaks the spirit of these rules. Have fun and catch ’em all! ⚡',
  ].join('\n'),
}

/** Calls the Discord API as the bot, waiting out rate limits. */
const discord = async (method, path, body) => {
  for (;;) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 429) {
      const { retry_after } = await res.json()
      await new Promise((r) => setTimeout(r, Math.ceil(retry_after * 1000) + 50))
      continue
    }
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`)
    return res.status === 204 ? null : res.json()
  }
}

const me = await discord('GET', '/users/@me')
const guild = await discord('GET', `/guilds/${GUILD}`).catch(() => {
  const invite = `https://discord.com/oauth2/authorize?client_id=${me.id}&scope=bot%20applications.commands&permissions=8&guild_id=${GUILD}`
  console.error(`The bot is not in the server yet. Invite it: ${invite}`)
  process.exit(1)
})
console.log(`Setting up "${guild.name}" as ${me.username}`)

// Roles: create or update, then order them under the bot's own role.
const existingRoles = await discord('GET', `/guilds/${GUILD}/roles`)
const roleId = {}
for (const role of ROLES) {
  const body = {
    name: role.name,
    color: role.color,
    hoist: !!role.hoist,
    mentionable: role.name.endsWith('Ping'),
    // Staff talk without needing the Trainer role on top.
    permissions: (role.staff ? MODERATE | TALK | VOICE : role.trainer && GATE ? TALK | VOICE : 0n).toString(),
  }
  const found = existingRoles.find((r) => r.name === role.name)
  roleId[role.name] = (found
    ? await discord('PATCH', `/guilds/${GUILD}/roles/${found.id}`, body)
    : await discord('POST', `/guilds/${GUILD}/roles`, body)
  ).id
}
// New roles land at the bottom and push the bot's role up, so read positions again.
const botTop = Math.max(...(await discord('GET', `/guilds/${GUILD}/roles`)).filter((r) => r.tags?.bot_id === me.id).map((r) => r.position), 1)
await discord('PATCH', `/guilds/${GUILD}/roles`, ROLES.map((r, i) => ({ id: roleId[r.name], position: botTop - 1 - i })).filter((r) => r.position > 0))

// Nobody but staff pings @everyone; behind the gate only Trainers talk.
const everyone = existingRoles.find((r) => r.id === GUILD)
const base = BigInt(everyone.permissions) & ~P.mentionEveryone
await discord('PATCH', `/guilds/${GUILD}/roles/${GUILD}`, {
  permissions: (GATE ? base & ~(TALK | VOICE) : base | TALK | VOICE).toString(),
})

const staff = ROLES.filter((r) => r.staff).map((r) => roleId[r.name])
const supporters = ROLES.filter((r) => r.supporter).map((r) => roleId[r.name])
const allow = (id, bits) => ({ id, type: 0, allow: bits.toString(), deny: '0' })
const deny = (id, bits) => ({ id, type: 0, allow: '0', deny: bits.toString() })

/** Permission overwrites for a channel, from its category's access and its own flags. */
const overwritesFor = (access, channel) => {
  const botMember = { id: me.id, type: 1, allow: (P.viewChannel | TALK).toString(), deny: '0' }
  if (access === 'staff') return [deny(GUILD, P.viewChannel), ...staff.map((id) => allow(id, P.viewChannel)), botMember]
  if (access === 'supporters')
    return [deny(GUILD, P.viewChannel), ...[...staff, ...supporters].map((id) => allow(id, P.viewChannel | TALK | VOICE)), botMember]
  if (channel?.readOnly) return [deny(GUILD, TALK), ...staff.map((id) => allow(id, TALK)), botMember]
  if (channel?.open) return [allow(GUILD, P.sendMessages)]
  // Onboarding needs @everyone to join its default voice channels: behind the gate they listen, Trainers talk.
  if (channel?.type === 'voice' && GATE) return [allow(GUILD, P.connect)]
  return []
}

// Channels: categories first, then their channels in order. News channels need
// Community, which needs the rules channel, so on the first run they start as
// text and are converted once Community is on.
const community = guild.features.includes('COMMUNITY')
const allChannels = await discord('GET', `/guilds/${GUILD}/channels`)
const channelId = {}
const sameType = (a, b) => a === b || (b === TYPE.news && a === TYPE.text)
const findChannel = (names, type, parentId) =>
  allChannels.find((c) => names.includes(c.name) && sameType(c.type, type) && (parentId === undefined || c.parent_id === parentId)) ??
  allChannels.find((c) => names.includes(c.name) && sameType(c.type, type))
const pendingNews = []

/** A channel where only Trainers talk: the gate's on, everyone sees it and nothing else opens it up. */
const gated = (group, channel) => GATE && !group.access && !channel.readOnly && !channel.open && channel.type !== 'voice'

/** Its topic, with the way in for a newcomer who can't type there yet (the composer only says "no permission"). */
const topicOf = (group, channel) =>
  [channel.topic, gated(group, channel) && channelId['introductions'] && `New here? Say hi in <#${channelId['introductions']}> to unlock chatting.`]
    .filter(Boolean)
    .join(' · ')

let position = 0
for (const group of LAYOUT) {
  const catBody = { name: group.category, type: TYPE.category, position: position++, permission_overwrites: overwritesFor(group.access) }
  const cat = findChannel([group.category], TYPE.category)
  const category = cat
    ? await discord('PATCH', `/channels/${cat.id}`, { name: catBody.name, position: catBody.position, permission_overwrites: catBody.permission_overwrites })
    : await discord('POST', `/guilds/${GUILD}/channels`, catBody)

  for (const channel of group.channels) {
    const type = TYPE[channel.type ?? 'text']
    const body = {
      name: channel.name,
      parent_id: category.id,
      position: position++,
      permission_overwrites: overwritesFor(group.access, channel),
      ...(type !== TYPE.voice && (channel.topic || gated(group, channel)) ? { topic: topicOf(group, channel) } : {}),
      ...(channel.slowmode ? { rate_limit_per_user: channel.slowmode } : {}),
    }
    const found = findChannel([channel.name, ...(channel.aliases ?? [])], type, category.id)
    // Tags are matched by name so posts keep theirs when the list changes.
    if (channel.tags) {
      const current = found?.available_tags ?? []
      body.available_tags = channel.tags.map((name) => ({ ...current.find((t) => t.name === name), name }))
    }
    const createAs = type === TYPE.news && !community ? TYPE.text : type
    const saved = found
      ? await discord('PATCH', `/channels/${found.id}`, body)
      : await discord('POST', `/guilds/${GUILD}/channels`, { ...body, type: createAs })
    channelId[channel.name] = saved.id
    if (type === TYPE.news && saved.type !== TYPE.news) pendingNews.push(saved.id)
    console.log(`  ${found ? 'updated' : 'created'} ${group.category} / ${channel.name}`)
  }
}

// Community: needed for news channels, forums' discovery, Onboarding and the welcome screen.
await discord('PATCH', `/guilds/${GUILD}`, {
  features: [...new Set([...guild.features, 'COMMUNITY'])],
  verification_level: Math.max(guild.verification_level, 1),
  explicit_content_filter: 2,
  default_message_notifications: 1,
  rules_channel_id: channelId['rules'],
  public_updates_channel_id: channelId['mod-log'],
  preferred_locale: 'en-US',
  description: 'A free browser survivors-like with Pokémon. Play at pokemonsurvivors.com',
})
for (const id of pendingNews) await discord('PATCH', `/channels/${id}`, { type: TYPE.news })

/** `<#name>` in the bot's texts, as the channel's real mention. */
const mentions = (text) => text.replace(/<#([\w-]+)>/g, (tag, name) => (channelId[name] ? `<#${channelId[name]}>` : tag))

/**
 * Posts the bot's message in a channel, or edits the one it already posted.
 * `pin` keeps it pinned, so it's found again however much the channel talks.
 */
const upsertMessage = async (channel, embed, pin = false) => {
  const id = channelId[channel]
  const seen = [...(pin ? await discord('GET', `/channels/${id}/pins`) : []), ...(await discord('GET', `/channels/${id}/messages?limit=50`))]
  const mine = seen.find((m) => m.author.id === me.id)
  const body = { content: '', embeds: [{ ...embed, description: mentions(embed.description) }] }
  const saved = mine ? await discord('PATCH', `/channels/${id}/messages/${mine.id}`, body) : await discord('POST', `/channels/${id}/messages`, body)
  if (pin && !saved.pinned) await discord('PUT', `/channels/${id}/pins/${saved.id}`)
}
await upsertMessage('welcome', WELCOME)
await upsertMessage('rules', RULES)
await upsertMessage('tiktok-reward', TIKTOK_REWARD, true)

await discord('PATCH', `/guilds/${GUILD}/welcome-screen`, {
  enabled: true,
  description: 'Survive the horde, evolve, and catch ’em all.',
  welcome_channels: [
    { channel_id: channelId['welcome'], description: 'What the game is and where to start', emoji_name: '👋' },
    { channel_id: channelId['rules'], description: 'Read before posting', emoji_name: '📜' },
    { channel_id: channelId['introductions'], description: GATE ? 'Say hi to unlock the server' : 'Say hi', emoji_name: '👋' },
    { channel_id: channelId['general'], description: 'Hang out with other trainers', emoji_name: '💬' },
    { channel_id: channelId['daily-challenge'], description: 'Post your Daily Challenge time', emoji_name: '🏆' },
  ],
})

// Starter emojis from the game's portraits (40 px, scaled 3x without smoothing):
// the teams' faces in Onboarding, and free for everyone in chat.
const emojis = await discord('GET', `/guilds/${GUILD}/emojis`)
const emojiId = {}
for (const starter of STARTER_PICKS) {
  const found = emojis.find((e) => e.name === starter.id)
  if (found) {
    emojiId[starter.id] = found.id
    continue
  }
  const png = execFileSync('ffmpeg', [
    '-loglevel', 'error', '-i', `public/assets/pokemon/${starter.dex}/portrait.png`,
    '-vf', 'scale=120:120:flags=neighbor', '-f', 'image2pipe', '-vcodec', 'png', '-',
  ])
  emojiId[starter.id] = (await discord('POST', `/guilds/${GUILD}/emojis`, { name: starter.id, image: `data:image/png;base64,${png.toString('base64')}` })).id
}

/** A fresh snowflake: Onboarding wants one per prompt and option. */
let seq = 0n
const snowflake = () => (((BigInt(Date.now()) - 1420070400000n) << 22n) | seq++).toString()

// Onboarding: everyone sees the core channels; languages and pings are picked.
const defaults = LAYOUT.filter((g) => !g.access)
  .flatMap((g) => g.channels)
  .filter((c) => !c.optIn)
  .map((c) => channelId[c.name])
await discord('PUT', `/guilds/${GUILD}/onboarding`, {
  enabled: true,
  mode: 0,
  default_channel_ids: defaults,
  prompts: [
    {
      id: snowflake(),
      type: 0,
      title: 'Pick your team!',
      single_select: true,
      required: true,
      in_onboarding: true,
      options: TEAMS.map((t) => ({
        id: snowflake(),
        title: t.title,
        description: t.description,
        emoji_id: emojiId[t.face],
        emoji_name: t.face,
        channel_ids: [],
        role_ids: [roleId[t.role]],
      })),
    },
    {
      id: snowflake(),
      type: 0,
      title: 'Which languages do you speak? (the main channels are in English)',
      single_select: false,
      required: false,
      in_onboarding: true,
      options: LANGUAGES.map(([channel, title, emoji]) => ({
        id: snowflake(),
        title,
        emoji_name: emoji,
        channel_ids: [channelId[channel]],
        role_ids: [],
      })),
    },
    {
      id: snowflake(),
      type: 0,
      title: 'What should we ping you about?',
      single_select: false,
      required: false,
      in_onboarding: true,
      options: PINGS.map(([role, title, description, emoji]) => ({
        id: snowflake(),
        title,
        description,
        emoji_name: emoji,
        channel_ids: [],
        role_ids: [roleId[role]],
      })),
    },
  ],
})

// AutoMod (free, native): blocks slurs/sexual content, spam, mass mentions and
// other servers' invites; staff are exempt and alerts land in #mod-log.
const BLOCK = (custom_message) => [
  { type: 1, metadata: { custom_message } },
  { type: 2, metadata: { channel_id: channelId['mod-log'] } },
]
const AUTOMOD = [
  { name: 'Slurs and sexual content', trigger_type: 4, trigger_metadata: { presets: [2, 3] }, actions: BLOCK('Let’s keep it friendly — check #rules.') },
  { name: 'Spam', trigger_type: 3, actions: [{ type: 1, metadata: { custom_message: 'That looks like spam.' } }] },
  { name: 'Mass mentions', trigger_type: 5, trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true }, actions: BLOCK('Too many mentions at once.') },
  {
    name: 'Invite links',
    trigger_type: 1,
    trigger_metadata: { regex_patterns: ['(discord\\.gg|discord(app)?\\.com/invite)/\\S+'] },
    actions: BLOCK('Invite links to other servers aren’t allowed.'),
  },
]
const rules = await discord('GET', `/guilds/${GUILD}/auto-moderation/rules`)
for (const rule of AUTOMOD) {
  const body = { ...rule, event_type: 1, enabled: true, exempt_roles: staff }
  const found = rules.find((r) => r.name === rule.name)
  if (found) {
    const { trigger_type, ...patch } = body
    await discord('PATCH', `/guilds/${GUILD}/auto-moderation/rules/${found.id}`, patch)
  } else await discord('POST', `/guilds/${GUILD}/auto-moderation/rules`, body)
}

// The owner gets the Dev role.
await discord('PUT', `/guilds/${GUILD}/members/${guild.owner_id}/roles/${roleId['Dev']}`)

console.log('Done.')

// Keeps the community Discord server in line with the spec below, through the
// bot, one step at a time and only what each step owns. Staff edit names, order
// and looks by hand; the script never touches those on what already exists.
// Things are found by the ids in ids.json, so a rename doesn't break a run.
//
//   node --env-file=.env.local scripts/discord/pull.mjs                     # snapshot first
//   node --env-file=.env.local scripts/discord/setup.mjs roles channels     # dry run: prints the diff
//   node --env-file=.env.local scripts/discord/setup.mjs roles --apply      # makes the changes
//
// Run it without a step to list them. Needs DISCORD_BOT_TOKEN and
// DISCORD_GUILD_ID. The bot must be in the server with Administrator (the
// invite link is printed when it isn't), and ffmpeg (for the starter emojis).

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { REGIONS, STARTERS } from '../../src/data/starters.ts'
import { TYPE_COLORS } from '../../src/data/types.ts'
import { discord, GUILD } from './api.mjs'

/**
 * The introduction gate: when on, only Trainers talk, and a newcomer earns the
 * role by posting in #introductions. Everyone still sees every public channel,
 * because Onboarding's default channels must be visible to @everyone. Keep it
 * off until the bot that hands out Trainer is running, or nobody gets past it.
 */
const GATE = true

const SITE = 'https://www.pokemonsurvivors.com'

// Permission bits (https://discord.com/developers/docs/topics/permissions).
const P = {
  kick: 1n << 1n,
  ban: 1n << 2n,
  manageChannels: 1n << 4n,
  manageGuild: 1n << 5n,
  addReactions: 1n << 6n,
  viewAuditLog: 1n << 7n,
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
  manageRoles: 1n << 28n,
  manageWebhooks: 1n << 29n,
  manageEvents: 1n << 33n,
  manageThreads: 1n << 34n,
  createPublicThreads: 1n << 35n,
  createPrivateThreads: 1n << 36n,
  sendMessagesInThreads: 1n << 38n,
  moderateMembers: 1n << 40n,
  useSoundboard: 1n << 42n,
}
const MODERATE =
  P.kick | P.ban | P.manageMessages | P.mentionEveryone | P.muteMembers | P.moveMembers | P.manageNicknames | P.manageThreads | P.moderateMembers
// Staff also run the server by hand: channels, roles below theirs, Onboarding, AutoMod, events.
const MANAGE =
  P.manageChannels | P.manageGuild | P.viewAuditLog | P.manageRoles | P.manageWebhooks | P.manageEmojis | P.manageEvents
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

// Top of the list first. `staff` roles see the staff and supporter channels; `supporter` roles (the API gives them
// by tier, `SUPPORTER_ROLES` in server/src/discordLink.ts, and OG Supporter for good to whoever supported before
// Patreon, `OG_ROLE`) see the 💛 Supporters category. OG goes under Diamond (staff drag it there: new roles land at the
// bottom), so an OG shows among the OGs unless they're Diamond.
const ROLES = [
  { name: 'Dev', color: 0xf8d030, hoist: true, staff: true },
  { name: 'Moderator', color: 0x6890f0, hoist: true, staff: true },
  { name: 'Diamond Supporter', color: 0x58c8f8, hoist: true, supporter: true },
  { name: 'OG Supporter', color: 0xa070f0, hoist: true, supporter: true },
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
// `aliases`: other names to find it by the first time, before ids.json has it.
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
      { name: 'arrivals', readOnly: true, topic: 'Who just landed. Join messages live here so the chat stays clean.' },
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
      {
        name: 'idea-review',
        topic: 'Ideas posted in the game land here first. React ✅ (or 👍) to put one on the board’s Backlog, ❌ (or 👎) to hide it.',
      },
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
    '',
    '**Where to go**',
    '📜 Read <#rules> first',
    GATE ? '👋 Introduce yourself in <#introductions> to unlock chatting everywhere' : '👋 Say hi in <#introductions>',
    '🗣️ Change your starter, languages and pings in **Channels & Roles** (top of the channel list)',
    '💬 Hang out in <#general>',
    '🎁 Follow us on TikTok for a free rare egg: <#tiktok-reward>',
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

const STEPS = {
  roles: 'role permissions, @everyone, the owner’s Dev role',
  channels: 'channel and category permissions, slowmode, forum tags; creates the missing ones',
  topics: 'channel topics, with the gate’s hint',
  community: 'Community settings, system and rules channels, the server description',
  messages: 'the bot’s welcome, rules and TikTok reward texts',
  welcome: 'the welcome screen',
  emojis: 'the starter emojis (creates the missing ones)',
  onboarding: 'Onboarding: default channels, team, languages and pings',
  automod: 'AutoMod rules',
}
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const steps = args.filter((a) => !a.startsWith('--'))
if (!steps.length || steps.some((s) => !(s in STEPS))) {
  console.log('Usage: setup.mjs <step...> [--apply]   (dry run without --apply)\n')
  for (const [step, what] of Object.entries(STEPS)) console.log(`  ${step.padEnd(11)} ${what}`)
  process.exit(steps.length ? 1 : 0)
}
const running = (step) => steps.includes(step)

// Spec keys → Discord ids. Things are found by id first, so renaming one by hand
// doesn't make the next run create it again; by name only the first time.
const IDS_FILE = new URL('./ids.json', import.meta.url)
const ids = existsSync(IDS_FILE) ? JSON.parse(readFileSync(IDS_FILE, 'utf8')) : {}
const saveIds = () => writeFileSync(IDS_FILE, `${JSON.stringify(ids, null, 2)}\n`)

/** A name without the emojis and separators staff put in front ("💬》off-topic" → "off-topic"). */
const bare = (name) => name.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase()

/** The live thing a spec key points to: by its saved id, else by name (and the id is saved). */
const resolve = (kind, key, live, byName) => {
  ids[kind] ??= {}
  const found = live.find((x) => x.id === ids[kind][key]) ?? live.find(byName)
  if (found) ids[kind][key] = found.id
  return found
}
const remember = (kind, key, id) => {
  if (APPLY) ids[kind][key] = id
}

/** Whether `current` already has everything in `desired`: extra fields are ignored, id lists are sets. */
const matches = (desired, current) => {
  if (Array.isArray(desired)) {
    if (!Array.isArray(current) || current.length !== desired.length) return false
    if (desired.every((d) => typeof d !== 'object')) return [...desired].map(String).sort().join() === [...current].map(String).sort().join()
    if (desired.every((d) => d?.id !== undefined)) return desired.every((d) => matches(d, current.find((c) => c.id === d.id)))
    return desired.every((d, i) => matches(d, current[i]))
  }
  if (desired && typeof desired === 'object') return !!current && Object.keys(desired).every((k) => matches(desired[k], current[k]))
  // Discord reads some empty fields back as "" and others as null.
  return String(desired ?? '') === String(current ?? '')
}

const short = (value) => {
  const text = JSON.stringify(value) ?? 'none'
  return text.length > 70 ? `${text.slice(0, 67)}...` : text
}

/** Writes with --apply; a dry run only prints what it would do and returns null. */
const write = async (label, method, path, body) => {
  console.log(`  ${APPLY ? '' : '(dry run) '}${label}`)
  return APPLY ? discord(method, path, body) : null
}

/** Patches only the fields of `body` that differ from `current`, listing each change. */
const patch = async (label, path, current, body) => {
  const changed = Object.keys(body).filter((k) => !matches(body[k], current?.[k]))
  if (!changed.length) return current
  const detail = changed.map((k) => `\n      ${k}: ${short(current?.[k])} → ${short(body[k])}`).join('')
  return (await write(`${label}${detail}`, 'PATCH', path, Object.fromEntries(changed.map((k) => [k, body[k]])))) ?? current
}

/** Creates a thing the spec has and the server doesn't; a dry run hands back a placeholder. */
const create = async (label, path, body) => (await write(`create ${label}`, 'POST', path, body)) ?? { id: `(new ${label})`, ...body }

const me = await discord('GET', '/users/@me')
const guild = await discord('GET', `/guilds/${GUILD}`).catch(() => {
  const invite = `https://discord.com/oauth2/authorize?client_id=${me.id}&scope=bot%20applications.commands&permissions=8&guild_id=${GUILD}`
  console.error(`The bot is not in the server yet. Invite it: ${invite}`)
  process.exit(1)
})
console.log(`${APPLY ? 'Applying' : 'Dry run'} on "${guild.name}" as ${me.username}: ${steps.join(', ')}`)

/** Fails a step that needs something only another step creates. */
const need = (id, what, step) => {
  if (!id) throw new Error(`${what} doesn't exist yet: run the ${step} step first`)
  return id
}

// Roles. Staff own their names, colors, order and display by hand; the script
// owns permissions and mentionability. New roles land at the bottom of the list.
const liveRoles = await discord('GET', `/guilds/${GUILD}/roles`)
const roleId = {}
if (running('roles')) console.log('roles')
for (const role of ROLES) {
  const found = resolve('roles', role.name, liveRoles, (r) => bare(r.name) === bare(role.name))
  roleId[role.name] = found?.id
  if (!running('roles')) continue
  const owned = {
    // Staff talk without needing the Trainer role on top.
    permissions: (role.staff ? MODERATE | MANAGE | TALK | VOICE : role.trainer && GATE ? TALK | VOICE : 0n).toString(),
    mentionable: role.name.endsWith('Ping'),
  }
  if (found) await patch(`role ${found.name}`, `/guilds/${GUILD}/roles/${found.id}`, found, owned)
  else {
    roleId[role.name] = (await create(`role ${role.name}`, `/guilds/${GUILD}/roles`, { ...owned, name: role.name, color: role.color, hoist: !!role.hoist })).id
    remember('roles', role.name, roleId[role.name])
  }
}
if (running('roles')) {
  // Nobody but staff pings @everyone; behind the gate only Trainers talk.
  const everyone = liveRoles.find((r) => r.id === GUILD)
  const base = BigInt(everyone.permissions) & ~P.mentionEveryone
  await patch('role @everyone', `/guilds/${GUILD}/roles/${GUILD}`, everyone, {
    permissions: (GATE ? base & ~(TALK | VOICE) : base | TALK | VOICE).toString(),
  })
  // The owner gets the Dev role.
  const owner = await discord('GET', `/guilds/${GUILD}/members/${guild.owner_id}`)
  if (!owner.roles.includes(roleId['Dev']))
    await write('give the owner the Dev role', 'PUT', `/guilds/${GUILD}/members/${guild.owner_id}/roles/${need(roleId['Dev'], 'Dev', 'roles')}`)
}

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

// Channels. Staff own names, order and categories by hand; the script owns who
// can see and talk where, slowmode and forum tags (and topics, in their own step).
// A missing channel is created at the end of its category for staff to place.
// News channels need Community, which needs the rules channel, so a brand-new
// server gets them as text and the next channels run converts them.
const community = guild.features.includes('COMMUNITY')
const liveChannels = await discord('GET', `/guilds/${GUILD}/channels`)
const channelId = {}
const sameType = (a, b) => a === b || (b === TYPE.news && a === TYPE.text)

/** A channel where only Trainers talk: the gate's on, everyone sees it and nothing else opens it up. */
const gated = (group, channel) => GATE && !group.access && !channel.readOnly && !channel.open && channel.type !== 'voice'

/** Its topic, with the way in for a newcomer who can't type there yet (the composer only says "no permission"). */
const topicOf = (group, channel) =>
  [channel.topic, gated(group, channel) && channelId['introductions'] && `New here? Say hi in <#${channelId['introductions']}> to unlock chatting.`]
    .filter(Boolean)
    .join(' · ')

if (running('channels')) console.log('channels')
// Resolve every channel first: topics point at #introductions wherever it sits.
const placed = LAYOUT.map((group) => ({
  group,
  category: resolve('channels', group.category, liveChannels, (c) => bare(c.name) === bare(group.category) && c.type === TYPE.category),
  channels: group.channels.map((channel) => {
    const type = TYPE[channel.type ?? 'text']
    const names = [channel.name, ...(channel.aliases ?? [])]
    const found = resolve('channels', channel.name, liveChannels, (c) => names.some((n) => bare(n) === bare(c.name)) && sameType(c.type, type))
    channelId[channel.name] = found?.id
    return { channel, type, found }
  }),
}))
for (const { group, category: cat, channels } of placed) {
  let category = cat
  if (running('channels')) {
    const overwrites = overwritesFor(group.access)
    if (category) await patch(`category ${category.name}`, `/channels/${category.id}`, category, { permission_overwrites: overwrites })
    else {
      category = await create(`category ${group.category}`, `/guilds/${GUILD}/channels`, { name: group.category, type: TYPE.category, permission_overwrites: overwrites })
      remember('channels', group.category, category.id)
    }
  }
  for (const { channel, type, found } of channels) {
    if (running('channels')) {
      const owned = {
        permission_overwrites: overwritesFor(group.access, channel),
        ...(channel.slowmode ? { rate_limit_per_user: channel.slowmode } : {}),
        ...(type === TYPE.news && community ? { type } : {}),
      }
      // Tags are matched by name so posts keep theirs when the list changes.
      if (channel.tags) {
        const current = found?.available_tags ?? []
        owned.available_tags = channel.tags.map((name) => ({ ...current.find((t) => t.name === name), name }))
      }
      if (found) await patch(`#${found.name}`, `/channels/${found.id}`, found, owned)
      else {
        const body = { ...owned, name: channel.name, parent_id: category.id, type: type === TYPE.news && !community ? TYPE.text : type }
        if (type !== TYPE.voice && (channel.topic || gated(group, channel))) body.topic = topicOf(group, channel)
        channelId[channel.name] = (await create(`#${channel.name} in ${group.category}`, `/guilds/${GUILD}/channels`, body)).id
        remember('channels', channel.name, channelId[channel.name])
      }
    }
    if (running('topics') && found && type !== TYPE.voice && (channel.topic || gated(group, channel)))
      await patch(`#${found.name}`, `/channels/${found.id}`, found, { topic: topicOf(group, channel) })
  }
}
if (running('topics') && !running('channels')) console.log('topics')

if (running('community')) {
  // Community: needed for news channels, forums' discovery, Onboarding and the welcome screen.
  console.log('community')
  await patch('server', `/guilds/${GUILD}`, guild, {
    ...(community ? {} : { features: [...guild.features, 'COMMUNITY'] }),
    verification_level: Math.max(guild.verification_level, 1),
    explicit_content_filter: 2,
    default_message_notifications: 1,
    rules_channel_id: need(channelId['rules'], '#rules', 'channels'),
    // Join, boost and setup-tip messages go to #arrivals instead of the chat.
    system_channel_id: need(channelId['arrivals'], '#arrivals', 'channels'),
    public_updates_channel_id: need(channelId['mod-log'], '#mod-log', 'channels'),
    preferred_locale: 'en-US',
    description: 'A free browser survivors-like with Pokémon. Play at pokemonsurvivors.com',
  })
}

/** `<#name>` in the bot's texts, as the channel's real mention. */
const mentions = (text) => text.replace(/<#([\w-]+)>/g, (tag, name) => (channelId[name] ? `<#${channelId[name]}>` : tag))

/**
 * Posts the bot's message in a channel, or edits the one it already posted.
 * `pin` keeps it pinned, so it's found again however much the channel talks.
 */
const upsertMessage = async (channel, embed, pin = false) => {
  const id = need(channelId[channel], `#${channel}`, 'channels')
  const seen = [...(pin ? await discord('GET', `/channels/${id}/pins`) : []), ...(await discord('GET', `/channels/${id}/messages?limit=50`))]
  const mine = seen.find((m) => m.author.id === me.id)
  const body = { content: '', embeds: [{ ...embed, description: mentions(embed.description) }] }
  const saved = mine
    ? await patch(`message in #${channel}`, `/channels/${id}/messages/${mine.id}`, mine, body)
    : await write(`post the message in #${channel}`, 'POST', `/channels/${id}/messages`, body)
  if (pin && saved && !saved.pinned) await write(`pin the message in #${channel}`, 'PUT', `/channels/${id}/pins/${saved.id}`)
}
if (running('messages')) {
  console.log('messages')
  await upsertMessage('welcome', WELCOME)
  await upsertMessage('rules', RULES)
  await upsertMessage('tiktok-reward', TIKTOK_REWARD, true)
}

if (running('welcome')) {
  console.log('welcome')
  const screen = await discord('GET', `/guilds/${GUILD}/welcome-screen`)
  const channel = (name, description, emoji_name) => ({ channel_id: need(channelId[name], `#${name}`, 'channels'), description, emoji_name, emoji_id: null })
  await patch('welcome screen', `/guilds/${GUILD}/welcome-screen`, { ...screen, enabled: guild.features.includes('WELCOME_SCREEN_ENABLED') }, {
    enabled: true,
    description: 'Survive the horde, evolve, and catch ’em all.',
    welcome_channels: [
      channel('welcome', 'What the game is and where to start', '👋'),
      channel('rules', 'Read before posting', '📜'),
      channel('introductions', GATE ? 'Say hi to unlock the server' : 'Say hi', '👋'),
      channel('general', 'Hang out with other trainers', '💬'),
      channel('daily-challenge', 'Post your Daily Challenge time', '🏆'),
    ],
  })
}

// Starter emojis from the game's portraits (40 px, scaled 3x without smoothing):
// the teams' faces in Onboarding, and free for everyone in chat.
const liveEmojis = await discord('GET', `/guilds/${GUILD}/emojis`)
const emojiId = {}
if (running('emojis')) console.log('emojis')
for (const starter of STARTER_PICKS) {
  emojiId[starter.id] = resolve('emojis', starter.id, liveEmojis, (e) => e.name === starter.id)?.id
  if (emojiId[starter.id] || !running('emojis')) continue
  const png = APPLY
    ? execFileSync('ffmpeg', [
        '-loglevel', 'error', '-i', `public/assets/pokemon/${starter.dex}/portrait.png`,
        '-vf', 'scale=120:120:flags=neighbor', '-f', 'image2pipe', '-vcodec', 'png', '-',
      ])
    : Buffer.alloc(0)
  emojiId[starter.id] = (await create(`emoji :${starter.id}:`, `/guilds/${GUILD}/emojis`, { name: starter.id, image: `data:image/png;base64,${png.toString('base64')}` })).id
  remember('emojis', starter.id, emojiId[starter.id])
}

if (running('onboarding')) {
  // Onboarding: everyone sees the core channels; languages and pings are picked.
  // Prompts and options keep their ids (matched by title), so members' picks stay.
  console.log('onboarding')
  const live = await discord('GET', `/guilds/${GUILD}/onboarding`)
  let seq = 0n
  /** A fresh snowflake: Onboarding wants one per new prompt and option. */
  const snowflake = () => (((BigInt(Date.now()) - 1420070400000n) << 22n) | seq++).toString()
  const prompt = (title, single_select, required, options) => {
    const current = live.prompts.find((p) => p.title === title)
    return {
      id: current?.id ?? snowflake(),
      type: 0,
      title,
      single_select,
      required,
      in_onboarding: true,
      options: options.map((o) => ({
        id: current?.options.find((c) => c.title === o.title)?.id ?? snowflake(),
        description: null,
        emoji_id: null,
        channel_ids: [],
        role_ids: [],
        ...o,
      })),
    }
  }
  const body = {
    enabled: true,
    mode: 0,
    default_channel_ids: LAYOUT.filter((g) => !g.access)
      .flatMap((g) => g.channels)
      .filter((c) => !c.optIn)
      .map((c) => need(channelId[c.name], `#${c.name}`, 'channels')),
    prompts: [
      prompt('Pick your team!', true, true, TEAMS.map((t) => ({
        title: t.title,
        description: t.description,
        emoji_id: need(emojiId[t.face], `:${t.face}:`, 'emojis'),
        emoji_name: t.face,
        role_ids: [need(roleId[t.role], t.role, 'roles')],
      }))),
      prompt('Which languages do you speak? (the main channels are in English)', false, false, LANGUAGES.map(([channel, title, emoji]) => ({
        title,
        emoji_name: emoji,
        channel_ids: [need(channelId[channel], `#${channel}`, 'channels')],
      }))),
      prompt('What should we ping you about?', false, false, PINGS.map(([role, title, description, emoji]) => ({
        title,
        description,
        emoji_name: emoji,
        role_ids: [need(roleId[role], role, 'roles')],
      }))),
    ],
  }
  // Discord reads options' emojis back as one `emoji` object.
  const current = {
    ...live,
    prompts: live.prompts.map((p) => ({
      ...p,
      options: p.options.map(({ emoji, ...o }) => ({ ...o, emoji_id: emoji?.id ?? null, emoji_name: emoji?.name ?? null })),
    })),
  }
  const changed = Object.keys(body).filter((k) => !matches(body[k], current[k]))
  if (changed.length) await write(`Onboarding: ${changed.join(', ')}`, 'PUT', `/guilds/${GUILD}/onboarding`, body)
}

if (running('automod')) {
  // AutoMod (free, native): blocks slurs/sexual content, spam, mass mentions and
  // other servers' invites; staff are exempt and alerts land in #mod-log.
  console.log('automod')
  const modLog = need(channelId['mod-log'], '#mod-log', 'channels')
  const BLOCK = (custom_message) => [
    { type: 1, metadata: { custom_message } },
    { type: 2, metadata: { channel_id: modLog } },
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
  const liveRules = await discord('GET', `/guilds/${GUILD}/auto-moderation/rules`)
  for (const rule of AUTOMOD) {
    const { name, trigger_type, ...owned } = { ...rule, event_type: 1, enabled: true, exempt_roles: staff.map((id) => need(id, 'a staff role', 'roles')) }
    const found = resolve('automod', name, liveRules, (r) => r.name === name)
    if (found) await patch(`AutoMod ${found.name}`, `/guilds/${GUILD}/auto-moderation/rules/${found.id}`, found, owned)
    else remember('automod', name, (await create(`AutoMod ${name}`, `/guilds/${GUILD}/auto-moderation/rules`, { ...owned, name, trigger_type })).id)
  }
}

saveIds()
console.log(APPLY ? 'Done. Run pull.mjs and commit the snapshot.' : 'Dry run: nothing changed. Add --apply to make these changes.')

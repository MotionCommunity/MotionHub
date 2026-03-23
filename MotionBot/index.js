require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder, ChannelType } = require('discord.js');
const { config } = require('./config');
const { commands } = require('./commands');
const { matchTimers, registerMatchTimer } = require('./commands');
const { startSchedulePoller } = require('./schedule-poller');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

client.commands = new Collection();
for (const command of commands) {
    client.commands.set(command.data.name, command);
}

// ── Register Slash Commands ───────────────────────────────────────────────
const rest = new REST().setToken(config.discord.token);

(async () => {
    try {
        console.log('⏳ Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
            { body: commands.map(c => c.data.toJSON()) }
        );
        console.log('✅ Slash commands registered successfully');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
})();

// ── Ready ─────────────────────────────────────────────────────────────────
client.once('ready', () => {
    console.log(`✅ Motion RL Bot is online as ${client.user.tag}`);
    console.log(`📡 Connected to ${client.guilds.cache.size} server(s)`);
    client.user.setActivity(config.labels.activity, { type: 3 });
    startSchedulePoller(client);
});

// ── Handle Slash Commands ─────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: '❌ An error occurred running this command.', ephemeral: true });
    }
});

// ── Replay Upload Timer ───────────────────────────────────────────────────
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const isThread = message.channel.isThread();
    const isPodText =
        message.channel.type === ChannelType.GuildText && matchTimers.has(message.channel.id);
    if (!isThread && !isPodText) return;

    const matchData = matchTimers.get(message.channel.id);
    if (!matchData) return;
    if (matchData.timerStarted) return;

    const hasReplay = message.attachments.some(a =>
        a.name && a.name.endsWith('.replay')
    );
    if (!hasReplay) return;

    matchData.timerStarted = true;

    const timerEmbed = new EmbedBuilder()
        .setColor(0xF97316)
        .setTitle('⏱️ Replay Received — 15 Minute Timer Started')
        .setDescription(
            'Losing team — type `/confirm` to approve the result.\n' +
            'Type `/dispute [reason]` if you disagree.\n\n' +
            '**If no response in 15 minutes, staff will be notified.**'
        )
        .setTimestamp();

    await message.channel.send({ embeds: [timerEmbed] });

    matchData.timer = setTimeout(async () => {
        if (matchData.confirmed) return;

        const staffChannel = message.guild.channels.cache.get(config.channels.staffChat);
        if (staffChannel) {
            const escalateEmbed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setTitle('⚠️ No Confirmation — Action Required')
                .setDescription(
                    `Losing team has not confirmed in ${message.channel}\n` +
                    `Match: **${matchData.team1}** vs **${matchData.team2}**\n` +
                    `Round: **${matchData.round}**`
                )
                .addFields({
                    name: 'Options',
                    value: '• Award default win to winning team\n• Contact losing team directly\n• Use `/match close` once resolved'
                })
                .setTimestamp();

            await staffChannel.send({
                content: `<@&${config.roles.staff}> — Replay timer expired, no confirmation received.`,
                embeds: [escalateEmbed]
            });
        }

        await message.channel.send(
            '⚠️ **15 minutes elapsed with no confirmation.** Staff has been notified.'
        );

    }, 15 * 60 * 1000);
});

// ── HTTP: register match thread for replay timer (league site "Start match in Discord") ──
const botInternalSecret = process.env.BOT_INTERNAL_SECRET?.trim();
const botHttpPort = Number(process.env.BOT_HTTP_PORT || process.env.PORT || 3849);

if (botInternalSecret) {
    http.createServer((req, res) => {
        if (req.method !== 'POST' || req.url !== '/internal/register-match-thread') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'not found' }));
            return;
        }
        const auth = req.headers.authorization || '';
        if (auth !== `Bearer ${botInternalSecret}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'unauthorized' }));
            return;
        }
        let body = '';
        req.on('data', (c) => {
            body += c;
        });
        req.on('end', () => {
            try {
                const json = JSON.parse(body || '{}');
                const channelId = json.channelId || json.threadId;
                const ok = registerMatchTimer(channelId, json);
                res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(ok ? { ok: true } : { error: 'need channelId or threadId and guildId' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: String(e?.message || e) }));
            }
        });
    }).listen(botHttpPort, '0.0.0.0', () => {
        console.log(`[Timer API] POST /internal/register-match-thread on port ${botHttpPort} (league site replay timer)`);
    });
} else {
    console.log('[Timer API] Set BOT_INTERNAL_SECRET to allow the league site to register replay timers.');
}

client.login(config.discord.token);
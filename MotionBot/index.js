require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const { commands } = require('./commands');
const { matchTimers } = require('./commands');
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
const rest = new REST().setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('⏳ Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
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
    client.user.setActivity('Motion RL Tournaments', { type: 3 });
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
    if (!message.channel.isThread()) return;

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

        const staffChannel = message.guild.channels.cache.get(process.env.CHANNEL_STAFF_CHAT);
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
                content: `<@&${process.env.ROLE_STAFF}> — Replay timer expired, no confirmation received.`,
                embeds: [escalateEmbed]
            });
        }

        await message.channel.send(
            '⚠️ **15 minutes elapsed with no confirmation.** Staff has been notified.'
        );

    }, 15 * 60 * 1000);
});
client.login(process.env.TOKEN);
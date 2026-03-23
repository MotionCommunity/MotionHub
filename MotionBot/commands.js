const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { config } = require('./config');

const matchTimers = new Map();

/** Match replay context: forum thread (legacy) or guild text channel (league-site pod). */
function isMatchReplayChannel(channel) {
    if (channel.isThread()) return true;
    return channel.type === ChannelType.GuildText && matchTimers.has(channel.id);
}

function roomLabel(roomKey) {
    return config.labels.matchRoomNames[roomKey] || `Match Room ${roomKey}`;
}

const commands = [

    // ── /match ────────────────────────────────────────────────────────────
    {
        data: new SlashCommandBuilder()
            .setName('match')
            .setDescription('Match management commands')
            .addSubcommand(sub => sub
                .setName('create')
                .setDescription('Create a new match thread')
                .addStringOption(opt => opt
                    .setName('team1')
                    .setDescription('First team name')
                    .setRequired(true))
                .addStringOption(opt => opt
                    .setName('team2')
                    .setDescription('Second team name')
                    .setRequired(true))
                .addStringOption(opt => opt
                    .setName('round')
                    .setDescription('Round name e.g. Semifinals, Grand Final')
                    .setRequired(true))
                .addStringOption(opt => opt
                    .setName('format')
                    .setDescription('Series format')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Best of 1', value: 'BO1' },
                        { name: 'Best of 3', value: 'BO3' },
                        { name: 'Best of 5', value: 'BO5' },
                        { name: 'Best of 7', value: 'BO7' },
                    ))
                .addStringOption(opt => opt
                    .setName('room')
                    .setDescription('Which match room to use')
                    .setRequired(true)
                    .addChoices(
                        { name: config.labels.matchRoomNames['1'], value: '1' },
                        { name: config.labels.matchRoomNames['2'], value: '2' },
                        { name: config.labels.matchRoomNames['3'], value: '3' },
                    ))
            )
            .addSubcommand(sub => sub
                .setName('close')
                .setDescription('Close and archive the current match thread')
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

        async execute(interaction) {
            const sub = interaction.options.getSubcommand();

            // ── CREATE ─────────────────────────────────────────────────────
            if (sub === 'create') {
                const team1  = interaction.options.getString('team1');
                const team2  = interaction.options.getString('team2');
                const round  = interaction.options.getString('round');
                const format = interaction.options.getString('format');
                const room   = interaction.options.getString('room');
                const voiceLabel = roomLabel(room);

                const replayCounts = {
                    BO1: '1 replay',
                    BO3: '2–3 replays',
                    BO5: '3–5 replays',
                    BO7: '4–7 replays'
                };

                // Look up team roles by name
                const team1Role = interaction.guild.roles.cache
                    .find(r => r.name.toLowerCase() === team1.toLowerCase());
                const team2Role = interaction.guild.roles.cache
                    .find(r => r.name.toLowerCase() === team2.toLowerCase());

                const team1Display = team1Role ? `<@&${team1Role.id}>` : `**${team1}**`;
                const team2Display = team2Role ? `<@&${team2Role.id}>` : `**${team2}**`;

                // Post ready-up embed in #match-announcements
                const announceChannel = interaction.guild.channels.cache.get(config.channels.matchAnnounce);
                if (!announceChannel) {
                    return interaction.reply({
                        content: '❌ Could not find #match-announcements channel.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const readyEmbed = new EmbedBuilder()
                    .setColor(0xE94560)
                    .setTitle(`🎮 ${round} — ${format}`)
                    .setDescription(
                        `${team1Display}  vs  ${team2Display}\n\n` +
                        `Both teams react ✅ below to confirm ready.\n` +
                        `Then join 🔊 **${voiceLabel}**`
                    )
                    .addFields(
                        { name: '⏱️ Ready-Up Deadline', value: '15 minutes — or match escalates to staff', inline: false },
                        { name: '📁 Replays Required', value: replayCounts[format], inline: true },
                        { name: '🔊 Voice Room', value: voiceLabel, inline: true }
                    )
                    .setFooter({ text: `${config.labels.footer} • React ✅ to confirm ready` })
                    .setTimestamp();

                const pingContent = [
                    team1Role ? `<@&${team1Role.id}>` : team1,
                    team2Role ? `<@&${team2Role.id}>` : team2
                ].join(' vs ') + ' — your match is ready!';

                const announceMsg = await announceChannel.send({
                    content: pingContent,
                    embeds: [readyEmbed]
                });
                await announceMsg.react('✅');

                // Create match thread in #match-results
                const matchChannel = interaction.guild.channels.cache.get(config.channels.matchResults);
                if (!matchChannel) {
                    return interaction.reply({
                        content: '❌ Could not find #match-results channel.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const thread = await matchChannel.threads.create({
                    name: `${round} — ${team1} vs ${team2}`,
                    autoArchiveDuration: 1440,
                    reason: 'Match replay submission thread'
                });

                const threadEmbed = new EmbedBuilder()
                    .setColor(0x0F3460)
                    .setTitle(`🎮 ${round} — ${format}`)
                    .setDescription(`${team1Display}  vs  ${team2Display}`)
                    .addFields(
                        { name: '📁 Replays Required', value: replayCounts[format], inline: true },
                        { name: '🔊 Voice Room', value: voiceLabel, inline: true },
                        { name: '⏱️ Submission Timer', value: '15 minutes from first .replay upload', inline: false },
                        { name: '📤 Winning Team', value: 'Upload all .replay files from this series here once complete.', inline: false },
                        { name: '📥 Losing Team', value: 'Type `/confirm` to agree with the result.\nType `/dispute [reason]` if you disagree.', inline: false },
                        { name: '⚠️ Warning', value: 'No replay submission within 15 minutes = default loss awarded to opposing team.', inline: false }
                    )
                    .setFooter({ text: `${config.labels.footer} • Timer starts on first .replay upload` })
                    .setTimestamp();

                await thread.send({ embeds: [threadEmbed] });
                await thread.send(`<@&${config.roles.staff}> — Match thread opened.`);

                // Store match data for timer tracking
                matchTimers.set(thread.id, {
                    team1, team2, round, format,
                    replayUploaded: false,
                    confirmed: false,
                    timerStarted: false,
                    timer: null,
                    threadId: thread.id,
                    guildId: interaction.guild.id
                });

                await interaction.reply({
                    content: `✅ Match created!\n📢 Ready-up posted in ${announceChannel}\n🧵 Thread: ${thread}`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // ── CLOSE ──────────────────────────────────────────────────────
            if (sub === 'close') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const thread = interaction.channel;
                if (!thread.isThread()) {
                    return interaction.reply({
                        content: '❌ This command can only be used inside a match thread.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const matchData = matchTimers.get(thread.id);
                if (matchData && matchData.timer) clearTimeout(matchData.timer);
                matchTimers.delete(thread.id);

                const closeEmbed = new EmbedBuilder()
                    .setColor(0x22C55E)
                    .setTitle('✅ Match Complete — Thread Archived')
                    .setDescription('This match has been processed. Thread is now locked and archived.')
                    .setFooter({ text: config.labels.footer })
                    .setTimestamp();

                await thread.send({ embeds: [closeEmbed] });
                await thread.setLocked(true);
                await thread.setArchived(true);

                await interaction.editReply({ content: '✅ Thread locked and archived.' });
            }
        }
    },

    // ── /confirm ──────────────────────────────────────────────────────────
    {
        data: new SlashCommandBuilder()
            .setName('confirm')
            .setDescription('Confirm the match result as the losing team'),

        async execute(interaction) {
            const thread = interaction.channel;

            if (!isMatchReplayChannel(thread)) {
                return interaction.reply({
                    content: '❌ Use this in a match results thread or the match replay channel (pod).',
                    flags: MessageFlags.Ephemeral
                });
            }

            const matchData = matchTimers.get(thread.id);
            if (matchData) {
                if (matchData.timer) clearTimeout(matchData.timer);
                matchData.confirmed = true;
            }

            // Collect all .replay attachments from thread
            const replayFiles = [];
            const messages = await thread.messages.fetch({ limit: 100 });
            messages.forEach(msg => {
                msg.attachments.forEach(attachment => {
                    if (attachment.name && attachment.name.endsWith('.replay')) {
                        replayFiles.push({
                            url: attachment.url,
                            name: attachment.name,
                            size: (attachment.size / 1024).toFixed(1) + ' KB',
                            uploadedBy: msg.author.tag,
                            uploadedAt: `<t:${Math.floor(msg.createdTimestamp / 1000)}:F>`
                        });
                    }
                });
            });

            // Confirm embed in thread
            const confirmEmbed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setTitle('✅ Result Confirmed')
                .setDescription(`**${interaction.member.displayName}** has confirmed the match result.`)
                .addFields(
                    { name: 'Confirmed By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Confirmed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { name: 'Replays Found', value: `${replayFiles.length} file(s)`, inline: true },
                    { name: 'Next Step', value: 'Staff will process this match. Thread stays open until `/match close` is run.', inline: false }
                )
                .setFooter({ text: config.labels.footer })
                .setTimestamp();

            await interaction.reply({ embeds: [confirmEmbed] });

            // Post to #processing-queue
            const queueChannel = interaction.guild.channels.cache.get(config.channels.processingQueue);
            if (queueChannel) {
                const queueEmbed = new EmbedBuilder()
                    .setColor(0x0F3460)
                    .setTitle(`📥 Ready to Process — ${thread.name}`)
                    .setDescription(`Match thread: ${thread}`)
                    .addFields(
                        {
                            name: '🎮 Match',
                            value: matchData
                                ? `**${matchData.team1}** vs **${matchData.team2}**\n${matchData.round} — ${matchData.format}`
                                : thread.name,
                            inline: false
                        },
                        {
                            name: '✅ Confirmed By',
                            value: `<@${interaction.user.id}>`,
                            inline: true
                        },
                        {
                            name: '🕐 Confirmed At',
                            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                            inline: true
                        },
                        {
                            name: '📁 Replay Files',
                            value: replayFiles.length > 0
                                ? replayFiles.map((f, i) =>
                                    `**${i + 1}.** ${f.name} (${f.size})\nUploaded by ${f.uploadedBy} at ${f.uploadedAt}`
                                  ).join('\n\n')
                                : '⚠️ No .replay files found in thread',
                            inline: false
                        },
                        {
                            name: '📋 Status',
                            value: '🟡 Awaiting processing in Windows App\nRun `/match close` in the thread when done.',
                            inline: false
                        }
                    )
                    .setFooter({ text: `${config.labels.footer} • Run /match close after processing` })
                    .setTimestamp();

                const attachments = replayFiles.map(f => ({
                    attachment: f.url,
                    name: f.name
                }));

                await queueChannel.send({
                    content: `<@&${config.roles.staff}> — New match ready to process!`,
                    embeds: [queueEmbed],
                    files: attachments.length > 0 ? attachments : []
                });
            }

            // Ping staff in #staff-chat
            const staffChannel = interaction.guild.channels.cache.get(config.channels.staffChat);
            if (staffChannel) {
                const staffEmbed = new EmbedBuilder()
                    .setColor(0x22C55E)
                    .setTitle('✅ Match Confirmed — Ready to Process')
                    .setDescription(`${thread} confirmed and posted to #processing-queue.`)
                    .addFields(
                        { name: 'Confirmed By', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Replay Files', value: `${replayFiles.length} file(s)`, inline: true },
                        { name: 'Action', value: 'Check #processing-queue, process in Windows App, then run `/match close` in the thread.', inline: false }
                    )
                    .setTimestamp();

                await staffChannel.send({
                    content: `<@&${config.roles.staff}>`,
                    embeds: [staffEmbed]
                });
            }
        }
    },

    // ── /dispute ──────────────────────────────────────────────────────────
    {
        data: new SlashCommandBuilder()
            .setName('dispute')
            .setDescription('Dispute the match result')
            .addStringOption(opt => opt
                .setName('reason')
                .setDescription('Reason for the dispute')
                .setRequired(true)
            ),

        async execute(interaction) {
            const thread = interaction.channel;
            const reason = interaction.options.getString('reason');

            if (!thread.isThread()) {
                return interaction.reply({
                    content: '❌ This command can only be used inside a match thread.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const matchData = matchTimers.get(thread.id);
            if (matchData && matchData.timer) clearTimeout(matchData.timer);

            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setTitle('⚠️ Result Disputed')
                .setDescription(`**${interaction.member.displayName}** has disputed this result.`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            const staffChannel = interaction.guild.channels.cache.get(config.channels.staffChat);
            if (staffChannel) {
                const staffEmbed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setTitle('🚨 Match Disputed — Action Required')
                    .setDescription(`Dispute filed in ${thread}`)
                    .addFields(
                        { name: 'Filed By', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Thread', value: thread.name, inline: true }
                    )
                    .setTimestamp();

                await staffChannel.send({
                    content: `<@&${config.roles.staff}>`,
                    embeds: [staffEmbed]
                });
            }
        }
    }
];

/**
 * Called from HTTP endpoint when staff starts a match from the league site (same state as /match create).
 */
function registerMatchTimer(channelId, data) {
    if (!channelId || !data?.guildId) return false;
    matchTimers.set(channelId, {
        team1: String(data.team1 || "Team A"),
        team2: String(data.team2 || "Team B"),
        round: String(data.round || "—"),
        format: String(data.format || "BO3"),
        replayUploaded: false,
        confirmed: false,
        timerStarted: false,
        timer: null,
        threadId: channelId,
        guildId: String(data.guildId)
    });
    return true;
}

module.exports = { commands, matchTimers, registerMatchTimer };
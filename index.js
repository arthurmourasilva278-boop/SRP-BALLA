const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    StringSelectMenuBuilder,
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField,
    AuditLogEvent,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');
const express = require('express');

// --- 🌐 SERVIDOR WEB PARA O RENDER ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('SRP | BALLA Bot está online e operando perfeitamente!');
});

app.listen(PORT, () => {
  console.log(`Servidor web rodando na porta ${PORT}`);
});
// ------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans
    ]
});

const BOT_NAME = "SRP | BALLA";
const ROLE_BOOSTER_ID = "1565957334507987054";
const WELCOME_CHANNEL_ID = "1565919892291584030";
const OWNER_ID = "1230674913564823562"; 

// --- Configuração da Armadilha e Exceções ---
const TRAP_CHANNEL_ID = "1565934311985782974";
const IMMUNE_USERS = ["1230674913564823562", "1166477445008998433"];

// --- 🛡️ SISTEMA ANTI-RAID AVANÇADO ---
let antiRaidActive = true; 
const recentJoins = new Map();
const channelCreations = new Map();
const activePoints = new Map();
const giveawayParticipants = new Map();

const ANTI_RAID_LIMIT = 5;       
const ANTI_RAID_TIME = 10000;    
const MIN_ACCOUNT_AGE = 7 * 24 * 60 * 60 * 1000; 

const CHANNEL_CREATION_LIMIT = 3; 
const CHANNEL_CREATION_TIME = 5000; 

// --- ⚡ DEFINIÇÃO DE TODOS OS COMANDOS SLASH ---
const commands = [
    new SlashCommandBuilder().setName('alianca').setDescription('Envia a ficha de parceria/aliança.'),
    new SlashCommandBuilder().setName('xfac').setDescription('Envia a ficha de desafio Xfac.'),
    new SlashCommandBuilder().setName('transferencia').setDescription('Envia a ficha de transferência para a BALLA.'),
    new SlashCommandBuilder().setName('rec').setDescription('Envia a ficha de recrutamento oficial da BALLA.'),
    new SlashCommandBuilder().setName('regras').setDescription('Envia o painel de regras e punições da facção.'),
    new SlashCommandBuilder().setName('painelticket').setDescription('Envia o painel central de atendimento e tickets.'),
    new SlashCommandBuilder().setName('bateponto').setDescription('Envia o sistema interativo de bate-ponto.'),
    new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Liga ou desliga o sistema anti-raid da quebrada.')
        .addStringOption(option => 
            option.setName('estado')
                .setDescription('Escolher entre ligar (on) ou desligar (off)')
                .setRequired(true)
                .addChoices(
                    { name: 'Ativar (On)', value: 'on' },
                    { name: 'Desativar (Off)', value: 'off' }
                )),
    new SlashCommandBuilder()
        .setName('sorteio')
        .setDescription('Inicia um sorteio na quebrada.')
        .addStringOption(option => option.setName('premio').setDescription('O que vai ser sorteado?').setRequired(true))
        .addIntegerOption(option => option.setName('tempo').setDescription('Duração do sorteio em minutos').setRequired(true))
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Bot ${BOT_NAME} ligado com segurança avançada como ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('A registrar comandos Slash (/)...');
        // Registo direto e instantâneo por guild para aparecer imediatamente no servidor
        const guilds = client.guilds.cache.map(guild => guild.id);
        for (const guildId of guilds) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
        }
        console.log('Comandos Slash registados com sucesso em todos os servidores!');
    } catch (error) {
        console.error('Erro ao registrar comandos Slash:', error);
    }
});

// --- 🛡️ EVENTO DE BOAS-VINDAS E ANTI-RAID ---
client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    const now = Date.now();

    if (antiRaidActive) {
        const accountAge = now - member.user.createdTimestamp;
        if (accountAge < MIN_ACCOUNT_AGE) {
            try {
                await member.kick("Anti-Raid Avançado: Conta muito nova (suspeita de bot/raid).");
                const logChannel = guild.systemChannel || guild.channels.cache.get(WELCOME_CHANNEL_ID);
                if (logChannel) {
                    const griaEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle(`🚨 TRETAS DETECTADAS NO CORRE! 🚨`)
                        .setDescription(`Anti-raid ativado. Quem tentar botar o louco não vai conseguir, vai ser kickado na hora e vai tomar o ban em dobro na quebrada!\n\n> **Maluco barrado:** ${member.user.tag}`)
                        .setTimestamp();
                    logChannel.send({ embeds: [griaEmbed] });
                }
                return; 
            } catch (e) {
                console.error("Erro ao expulsar conta nova:", e);
            }
        }
    }

    if (member.premiumSince) {
        await member.roles.add(ROLE_BOOSTER_ID).catch(() => {});
    }

    const welcomeChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#800080')
            .setTitle(`🟣 SEJA BEM-VINDO(A) À ${BOT_NAME}!`)
            .setDescription(`E aí ${member}! Salve, salve! É uma honra ter você com a gente. Aproveite a estadia e bom jogo! 🤝🔥`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        welcomeChannel.send({ content: `👋 Salve ${member}!`, embeds: [welcomeEmbed] });
    }
});

// --- 🚪 EVENTO DE SAÍDA / BANIMENTO ---
client.on('guildMemberRemove', async (member) => {
    const guild = member.guild;
    const channel = guild.channels.cache.get(WELCOME_CHANNEL_ID) || guild.systemChannel;
    if (!channel) return;

    await new Promise(resolve => setTimeout(resolve, 1500));
    let wasBanned = false;
    try {
        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const banLog = fetchedLogs.entries.first();
        if (banLog && banLog.target.id === member.id && (Date.now() - banLog.createdAt.getTime() < 6000)) {
            wasBanned = true;
        }
    } catch (e) {}

    if (wasBanned) {
        const banEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`⛔ MEMBRO BANIDO!`)
            .setDescription(`O usuário **${member.user.tag}** vacilou e foi **BANIDO**! 🔨⚡`);
        channel.send({ embeds: [banEmbed] }).catch(() => {});
    } else {
        const leaveEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(`👋 MEMBRO SAIU`)
            .setDescription(`O usuário **${member.user.tag}** meteu o pé do servidor. Valeu pela caminhada! 🤝`);
        channel.send({ embeds: [leaveEmbed] }).catch(() => {});
    }
});

// --- APENAS CANAL ARMADILHA NO MESSAGE CREATE ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.id === TRAP_CHANNEL_ID) {
        if (!IMMUNE_USERS.includes(message.author.id)) {
            try {
                await message.delete().catch(() => {});
                if (message.member && message.member.kickable) {
                    await message.member.kick("Digitou no canal armadilha.");
                    const logChannel = message.guild.channels.cache.get(WELCOME_CHANNEL_ID) || message.guild.systemChannel;
                    if (logChannel) logChannel.send(`🪤 O usuário **${message.author.tag}** caiu na armadilha e foi **EXPULSO**!`);
                }
            } catch (err) {}
            return;
        }
    }
});

// --- 🎯 TRATAMENTO DE INTERAÇÕES (COMANDOS SLASH) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'alianca') return await interaction.reply({ content: `PARCERIA 🤝\n\nNOME FAC:\nQUANTOS MEMBROS:\nFAC OFICIAL:\nLIDER:` });
        if (commandName === 'xfac') return await interaction.reply({ content: `# xfac\n> Fac:\n> Valor:\n> Horário:\n> Quantos v quantos:\n> Regras:\n> Local:\n> Melhor de quantos:` });
        if (commandName === 'transferencia') return await interaction.reply({ content: `TRANSFERÊNCIA PARA A BALLA\n\n**Seu Nick:\nSua facção:\nCargo desejado:\nProvas/ print:**` });
        if (commandName === 'rec') return await interaction.reply({ content: `**RECRUTAMENTO | BALLA**\n👤 Nome:\n🎂 Idade real:\n🎮 Nick Roblox:` });

        if (commandName === 'regras') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return await interaction.reply({ content: "❌ Apenas administradores podem enviar as regras!", ephemeral: true });
            }
            const regrasEmbed = new EmbedBuilder().setColor('#800080').setTitle(`————————• REGRAS ——————————`).setDescription('• Proibido racismo\n• Respeitar a hierarquia\n• Siga as regras do RP');
            const punicoesEmbed = new EmbedBuilder().setColor('#FF0000').setTitle(`————————• Punições ——————————`).setDescription('• Preconceitos: 1 a 7 dias');
            await interaction.channel.send({ embeds: [regrasEmbed, punicoesEmbed] });
            return await interaction.reply({ content: "✅ Regras enviadas com sucesso!", ephemeral: true });
        }

        if (commandName === 'painelticket') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return await interaction.reply({ content: "❌ Apenas administradores podem enviar o painel!", ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor('#800080')
                .setTitle(`🎟️ Central de Atendimento — ${BOT_NAME}`)
                .setDescription('Central de atendimento\n\n• Um canal privado será criado para você');
            const optionsMenu = new StringSelectMenuBuilder()
                .setCustomId('menu_opcoes')
                .setPlaceholder('Opções')
                .addOptions([
                    { label: 'Falar com gestão', value: 'ticket_gestao', emoji: '🗣️' },
                    { label: 'Dúvidas', value: 'ticket_duvidas', emoji: '❓' },
                    { label: 'Outros', value: 'ticket_outros', emoji: '📌' },
                    { label: 'Alianças', value: 'ticket_aliancas', emoji: '🛡️' },
                    { label: 'Denúncias', value: 'ticket_denuncias', emoji: '🚨' },
                    { label: 'Booster', value: 'ticket_booster', emoji: '🚀' }
                ]);
            const factionMenu = new StringSelectMenuBuilder()
                .setCustomId('menu_faccao')
                .setPlaceholder('Facção')
                .addOptions([
                    { label: 'Xfac', value: 'ticket_xfac', emoji: '🤝' },
                    { label: 'Transferência', value: 'ticket_transferencia', emoji: '🔄' },
                    { label: 'Pagar Metas', value: 'ticket_pagarmetas', emoji: '💰' },
                    { label: 'Solicitar cargo', value: 'ticket_solicitar_cargo', emoji: '🏷️' },
                    { label: 'Recrutamento', value: 'ticket_recrutamento', emoji: '📥' }
                ]);
            await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(optionsMenu), new ActionRowBuilder().addComponents(factionMenu)] });
            return await interaction.reply({ content: "✅ Painel de tickets enviado com sucesso!", ephemeral: true });
        }

        if (commandName === 'bateponto') {
            const embed = new EmbedBuilder()
                .setColor('#800080')
                .setTitle(`⏱️ Sistema de Bate-Ponto — ${BOT_NAME}`)
                .setDescription('Clique no botão abaixo para iniciar ou encerrar o seu ponto.');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ponto_iniciar').setLabel('Iniciar Ponto').setStyle(ButtonStyle.Success).setEmoji('🟢'),
                new ButtonBuilder().setCustomId('ponto_encerrar').setLabel('Encerrar Ponto').setStyle(ButtonStyle.Danger).setEmoji('🔴')
            );
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return await interaction.reply({ content: "✅ Bate-ponto enviado!", ephemeral: true });
        }

        if (commandName === 'antiraid') {
            if (interaction.user.id !== OWNER_ID) {
                return await interaction.reply({ content: "❌ **Acesso negado!** Só o chefe pode mexer na segurança da quebrada.", ephemeral: true });
            }
            const estado = interaction.options.getString('estado');
            if (estado === 'off') {
                antiRaidActive = false;
                return await interaction.reply({ content: "⚠️ **Anti-Raid desligado!**", ephemeral: true });
            } else {
                antiRaidActive = true;
                return await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00FF00').setTitle(`🛡️ ESCUDO LIGADO!`).setDescription(`Anti-raid ativado. Quem tentar fazer gracinha vai tomar!`)] });
            }
        }

        if (commandName === 'sorteio') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return await interaction.reply({ content: "❌ Apenas administradores podem iniciar sorteios!", ephemeral: true });
            }

            const premio = interaction.options.getString('premio');
            const tempoMinutos = interaction.options.getInteger('tempo');
            const tempoMs = tempoMinutos * 60 * 1000;
            const terminoTimestamp = Math.floor((Date.now() + tempoMs) / 1000);

            const giveawayEmbed = new EmbedBuilder()
                .setColor('#800080')
                .setTitle(`🎉 SORTEIO — ${BOT_NAME} 🎉`)
                .setDescription(`🎁 **Prêmio:** **${premio}**\n\n👑 **Criado por:** ${interaction.user}\n⏰ **Termina em:** <t:${terminoTimestamp}:R>\n\n👇 Clica no botão abaixo para participar!`);

            const giveawayRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join_giveaway').setLabel('Participar').setStyle(ButtonStyle.Success).setEmoji('🎉')
            );

            await interaction.reply({ content: `✅ Sorteio iniciado com sucesso!`, ephemeral: true });
            const giveawayMessage = await interaction.channel.send({ embeds: [giveawayEmbed], components: [giveawayRow] });

            giveawayParticipants.set(giveawayMessage.id, new Set());

            setTimeout(async () => {
                const participantsSet = giveawayParticipants.get(giveawayMessage.id);
                const participantsArray = Array.from(participantsSet || []);

                if (participantsArray.length === 0) {
                    const endedEmbed = new EmbedBuilder().setColor('#FF0000').setTitle(`🎉 SORTEIO ENCERRADO`).setDescription(`Nenhum participante.`);
                    await giveawayMessage.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
                    giveawayParticipants.delete(giveawayMessage.id);
                    return;
                }

                const winnerId = participantsArray[Math.floor(Math.random() * participantsArray.length)];
                const winnerEmbed = new EmbedBuilder().setColor('#00FF00').setTitle(`🎉 VENCEDOR DO SORTEIO!`).setDescription(`🏆 Vencedor: <@${winnerId}>\nPrêmio: **${premio}**`);

                await giveawayMessage.edit({ embeds: [winnerEmbed], components: [] }).catch(() => {});
                await giveawayMessage.reply(`🎉 Parabéns <@${winnerId}>! Você ganhou **${premio}**! 🚀🔥`);
                giveawayParticipants.delete(giveawayMessage.id);
            }, tempoMs);
        }
    }

    if (interaction.isButton()) {
        const userId = interaction.user.id;
        if (interaction.customId === 'join_giveaway') {
            const messageId = interaction.message.id;
            if (!giveawayParticipants.has(messageId)) return await interaction.reply({ content: `❌ Sorteio encerrado!`, ephemeral: true });
            const participantsSet = giveawayParticipants.get(messageId);
            if (participantsSet.has(userId)) return await interaction.reply({ content: `⚠️ Já estás a participar!`, ephemeral: true });
            participantsSet.add(userId);
            return await interaction.reply({ content: `✅ Participação garantida! 🍀`, ephemeral: true });
        }

        if (interaction.customId === 'ponto_iniciar') {
            activePoints.set(userId, { startTime: Date.now(), startStr: new Date().toLocaleTimeString() });
            return await interaction.reply({ content: `🟢 Ponto iniciado!`, ephemeral: true });
        }

        if (interaction.customId === 'ponto_encerrar') {
            const data = activePoints.get(userId);
            if (!data) return await interaction.reply({ content: `❌ Não tens ponto iniciado!`, ephemeral: true });
            activePoints.delete(userId);
            return await interaction.reply({ content: `🔴 Ponto encerrado com sucesso!`, ephemeral: true });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 Fechando ticket...' });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }
    }

    if (interaction.isStringSelectMenu()) {
        const ticketType = interaction.values[0].replace('ticket_', '');
        const guild = interaction.guild;
        const member = interaction.user;

        try {
            const ticketChannel = await guild.channels.create({
                name: `${ticketType}-${member.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                ],
            });

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            const openedEmbed = new EmbedBuilder()
                .setColor('#800080')
                .setTitle(`Ticket: ${ticketType.toUpperCase().replace('_', ' ')}`)
                .setDescription(`Olá ${member}, seu ticket foi aberto com sucesso!\nExplique o motivo do seu contato e aguarde a equipe responsável (${BOT_NAME}).`);

            await ticketChannel.send({ content: `${member}`, embeds: [openedEmbed], components: [closeRow] });
            await interaction.reply({ content: `✅ Seu ticket foi aberto em: ${ticketChannel}`, ephemeral: true });

        } catch (error) {
            await interaction.reply({ content: '❌ Ocorreu um erro ao criar o seu ticket.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

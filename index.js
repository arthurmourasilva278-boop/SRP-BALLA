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
    AuditLogEvent 
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
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.AutoModerationConfiguration
    ]
});

const BOT_NAME = "SRP | BALLA";
const ROLE_BOOSTER_ID = "1565957334507987054";
const WELCOME_CHANNEL_ID = "1565919892291584030"; // ID do canal de entrada configurado

// 👑 COLOQUE O SEU ID DO DISCORD AQUI (Somente você poderá ativar/desativar o Anti-Raid):
const OWNER_ID = "1230674913564823562"; 

// --- 🛡️ SISTEMA ANTI-RAID AVANÇADO ---
let antiRaidActive = true; // Status do Anti-Raid (Ativado por padrão)
const recentJoins = new Map();
const channelCreations = new Map();

const ANTI_RAID_LIMIT = 5;       
const ANTI_RAID_TIME = 10000;    
const MIN_ACCOUNT_AGE = 7 * 24 * 60 * 60 * 1000; 

const CHANNEL_CREATION_LIMIT = 3; 
const CHANNEL_CREATION_TIME = 5000; 

client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    const now = Date.now();

    if (antiRaidActive) {
        // 1. ANÁLISE DE CONTA NOVA (Anti-Alt/Bot)
        const accountAge = now - member.user.createdTimestamp;
        if (accountAge < MIN_ACCOUNT_AGE) {
            try {
                await member.kick("Anti-Raid Avançado: Conta muito nova (suspeita de bot/raid).");
                
                const logChannel = guild.systemChannel || guild.channels.cache.get(WELCOME_CHANNEL_ID);
                if (logChannel) {
                    const griaEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle(`🚨 TRETAS DETECTADAS NO CORRE! 🚨`)
                        .setDescription(`Anti-raid ativado. Quem tentar não vai conseguir, vai ser kickado na hora e vai tomar.\n\n> **Maluco barrado:** ${member.user.tag} (Conta cria nova demais, mandado pra fora na marra!).`)
                        .setTimestamp();
                    logChannel.send({ embeds: [griaEmbed] });
                }
                return; 
            } catch (e) {
                console.error("Erro ao expulsar conta nova no anti-raid:", e);
            }
        }

        // 2. PROTEÇÃO CONTRA ENTRADA EM MASSA (Flood)
        if (!recentJoins.has(guild.id)) {
            recentJoins.set(guild.id, []);
        }
        const timestamps = recentJoins.get(guild.id);
        timestamps.push(now);

        const windowStart = now - ANTI_RAID_TIME;
        const recent = timestamps.filter(time => time > windowStart);
        recentJoins.set(guild.id, recent);

        if (recent.length >= ANTI_RAID_LIMIT) {
            const alertChannel = guild.systemChannel || guild.channels.cache.get(WELCOME_CHANNEL_ID);
            if (alertChannel) {
                const raidEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`🚨 VISÃO! OS INVASOR TENTARAM BROTAR! 🚨`)
                    .setDescription(`Anti-raid ativado. Quem tentar não vai conseguir, vai ser kickado na hora e vai tomar.\n\nFluxo anormal de **${recent.length} cabaços** em segundos. O servidor fechou a banca e ativou o modo blindado!`)
                    .setTimestamp();
                
                alertChannel.send({ embeds: [raidEmbed] });
            }

            try {
                await guild.setVerificationLevel(4);
            } catch (e) {
                console.error("Não foi possível alterar o nível de verificação automaticamente:", e);
            }
            return;
        }
    }

    // 3. CARGO AUTOMÁTICO DE BOOSTER
    if (member.premiumSince) {
        try {
            await member.roles.add(ROLE_BOOSTER_ID);
        } catch (e) {
            console.error("Erro ao atribuir cargo de booster:", e);
        }
    }

    // 4. MENSAGEM DE ENTRADA (WELCOME)
    const welcomeChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#800080')
            .setTitle(`🟣 SEJA BEM-VINDO(A) À ${BOT_NAME}!`)
            .setDescription(
                `E aí ${member}! Salve, salve! É uma honra ter você com a gente.\n\n` +
                `Antes de colar no corre e começar o seu RP, fique atento:\n\n` +
                `📜 **1. Fique por dentro:** Leia nossas regras no canal oficial.\n` +
                `🎫 **2. Atendimento:** Abra um ticket caso precise de suporte, transferências ou pagar metas.\n` +
                `🚀 **3. Impulsione:** Deixe seu **Boost** no servidor e ganhe seu cargo VIP automaticamente!\n\n` +
                `Aproveite a estadia, mantenha o foco no personagem e bom jogo! 🤝🔥`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `Membro nº ${guild.memberCount} • ${BOT_NAME}`, 
                iconURL: guild.iconURL({ dynamic: true }) 
            })
            .setTimestamp();

        welcomeChannel.send({ content: `👋 Salve ${member}!`, embeds: [welcomeEmbed] });
    }
});

// 🛡️ DETETO CRIAÇÃO EM MASSA DE CANAIS E BANE O UTILIZADOR NA MARRA
client.on('guildChannelCreate', async (channel) => {
    if (!antiRaidActive) return;
    const guild = channel.guild;

    try {
        const fetchedLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.ChannelCreate,
        });

        const channelLog = fetchedLogs.entries.first();
        if (!channelLog) return;

        const { executor } = channelLog;
        if (!executor || executor.bot || executor.id === OWNER_ID) return;

        const now = Date.now();
        if (!channelCreations.has(executor.id)) {
            channelCreations.set(executor.id, []);
        }

        const userTimestamps = channelCreations.get(executor.id);
        userTimestamps.push(now);

        const windowStart = now - CHANNEL_CREATION_TIME;
        const recentCreations = userTimestamps.filter(time => time > windowStart);
        channelCreations.set(executor.id, recentCreations);

        if (recentCreations.length >= CHANNEL_CREATION_LIMIT) {
            const memberToBan = await guild.members.fetch(executor.id).catch(() => null);
            if (memberToBan) {
                await memberToBan.ban({ reason: "Anti-Raid: Tentativa de criação em massa de canais." });

                const alertChannel = guild.systemChannel || guild.channels.cache.get(WELCOME_CHANNEL_ID);
                if (alertChannel) {
                    const banEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle(`🚨 TENTARAM Bugar A BASE E DANÇARAM! 🚨`)
                        .setDescription(`Anti-raid ativado. Quem tentar não vai conseguir, vai ser kickado na hora e vai tomar.\n\nO comédia do **${executor.tag}** achou que ia lotar de canal e tomou **BAN PERMANENTE** na hora! ⚡`);
                    
                    alertChannel.send({ embeds: [banEmbed] });
                }
            }
        }
    } catch (e) {
        console.error("Erro no sistema anti-raid de canais:", e);
    }
});

// Evento para quando impulsionar depois de entrar
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!oldMember.premiumSince && newMember.premiumSince) {
        try {
            await newMember.roles.add(ROLE_BOOSTER_ID);
        } catch (e) {
            console.error("Erro ao atribuir cargo de booster:", e);
        }
    }
});

client.once('clientReady', () => {
    console.log(`Bot ${BOT_NAME} ligado com segurança avançada como ${client.user.tag}!`);
});

// --- COMANDOS DO BOT ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 🔒 COMANDO EXCLUSIVO DO DONO PARA LIGAR/DESLIGAR O ANTI-RAID
    if (message.content.startsWith('!antiraid')) {
        if (message.author.id !== OWNER_ID) {
            return message.reply("❌ **Acesso negado!** Só o chefe pode mexer na segurança da quebrada.");
        }

        const args = message.content.split(' ');
        const option = args[1]?.toLowerCase();

        if (option === 'off' || option === 'desativar') {
            antiRaidActive = false;
            return message.reply("⚠️ **Anti-Raid desligado!** A firma tá vulnerável, cuidado.");
        } else if (option === 'on' || option === 'ativar') {
            antiRaidActive = true;
            
            // Embed em gírias quando o dono liga o comando manualmente
            const ligadoEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`🛡️ ESCUDO LIGADO! A FIRMA TÁ BLINDADA! 🛡️`)
                .setDescription(`Anti-raid ativado. Quem tentar não vai conseguir, vai ser kickado na hora e vai tomar.`);
            
            return message.reply({ embeds: [ligadoEmbed] });
        } else {
            return message.reply(`Situação do Anti-Raid: **${antiRaidActive ? 'ATIVADO ✅' : 'DESATIVADO ❌'}**\nManda \`!antiraid on\` para blindar ou \`!antiraid off\` para desativar.`);
        }
    }

    // Comando !painelticket com Menus Dropdown (Estilo Opções / Facção)
    if (message.content === '!painelticket') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Apenas administradores podem usar este comando.");
        }

        const embed = new EmbedBuilder()
            .setColor('#800080')
            .setTitle(`🎟️ Central de Atendimento — ${BOT_NAME}`)
            .setDescription(
                'Central de atendimento\n\n' +
                '• Um canal privado será criado apenas para você\n\n' +
                '• Apenas você e nossa equipe de suporte terá acesso\n\n' +
                '• Nossa equipe responderá o mais rápido possível\n\n' +
                'IMPORTANTE\n' +
                '• Use o sistema de ticket apenas para questões que precisam de suporte'
            )
            .setFooter({ text: `Desenvolvido por krozz • ${BOT_NAME}` });

        const optionsMenu = new StringSelectMenuBuilder()
            .setCustomId('menu_opcoes')
            .setPlaceholder('Opções')
            .addOptions([
                { label: 'Sugestão', description: 'Enviar uma ideia para melhoria', value: 'ticket_sugestao', emoji: '💡' },
                { label: 'Alianças', description: 'Tratar sobre parcerias', value: 'ticket_aliancas', emoji: '🛡️' },
                { label: 'Denúncias', description: 'Reportar infrações', value: 'ticket_denuncias', emoji: '🚨' },
                { label: 'Booster', description: 'Benefícios de impulsionador', value: 'ticket_booster', emoji: '🚀' }
            ]);

        const factionMenu = new StringSelectMenuBuilder()
            .setCustomId('menu_faccao')
            .setPlaceholder('Facção')
            .addOptions([
                { label: 'Xfac', description: 'Negociações e acordos entre facções', value: 'ticket_xfac', emoji: '🤝' },
                { label: 'Transferência', description: 'Mudança de fac ou setor', value: 'ticket_transferencia', emoji: '🔄' },
                { label: 'Pagar Metas', description: 'Envio de provas de metas', value: 'ticket_pagarmetas', emoji: '💰' },
                { label: 'Setagem', description: 'Ajustes de cargos/setor', value: 'ticket_setagem', emoji: '⚙️' },
                { label: 'Recrutamento', description: 'Informações para entrada na fac', value: 'ticket_recrutamento', emoji: '📥' }
            ]);

        const row1 = new ActionRowBuilder().addComponents(optionsMenu);
        const row2 = new ActionRowBuilder().addComponents(factionMenu);

        await message.channel.send({ embeds: [embed], components: [row1, row2] });
        await message.delete().catch(() => {});
    }

    // Comando !regras
    if (message.content === '!regras') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Apenas administradores podem usar este comando.");
        }

        const regrasEmbed = new EmbedBuilder()
            .setColor('#800080')
            .setTitle(`————————• REGRAS ——————————`)
            .setDescription(
                '• Proibido racismo\n' +
                '• Proibido Gordofobia\n' +
                '• Proibido Xenofobia\n' +
                '• Sem nenhum tipo de preconceito\n' +
                '• Respeitar a hierarquia\n' +
                '• Respeitar os canais\n' +
                '• Não sair do personagem\n' +
                '• Siga as regras do RP'
            );

        const punicoesEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`————————• Punições ——————————`)
            .setDescription(
                '• **Preconceitos:** 1 a 7 dias *(racismo é perm)*\n' +
                '• **Xingar sem motivo:** adv (1/3)\n' +
                '• **Não respeitar a hierarquia:** adv (1/3)\n' +
                '• **Não seguir as regras do RP:** Castigo (1/3), 1h pronto.'
            );

        await message.channel.send({ embeds: [regrasEmbed, punicoesEmbed] });
        await message.delete().catch(() => {});
    }
});

// --- INTERAÇÃO DOS MENUS DROPDOWN E BOTÕES ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        const ticketType = interaction.values[0].replace('ticket_', '');
        const guild = interaction.guild;
        const member = interaction.user;

        try {
            const ticketChannel = await guild.channels.create({
                name: `${ticketType}-${member.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: member.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                    }
                ],
            });

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            const openedEmbed = new EmbedBuilder()
                .setColor('#800080')
                .setTitle(`Ticket: ${ticketType.toUpperCase()}`)
                .setDescription(`Olá ${member}, seu ticket foi aberto com sucesso!\nExplique o motivo do seu contato e aguarde a equipe responsável (${BOT_NAME}).`);

            await ticketChannel.send({ content: `${member}`, embeds: [openedEmbed], components: [closeRow] });
            await interaction.reply({ content: `✅ Seu ticket foi aberto em: ${ticketChannel}`, ephemeral: true });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Ocorreu um erro ao criar o seu ticket.', ephemeral: true });
        }
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'close_ticket') {
        const channel = interaction.channel;
        await interaction.reply({ content: '🔒 Fechando ticket em 5 segundos...' });
        setTimeout(() => {
            channel.delete().catch(() => {});
        }, 5000);
    }
});

// Faz o login utilizando a variável de ambiente segura configurada no Render (DISCORD_TOKEN)
client.login(process.env.DISCORD_TOKEN);

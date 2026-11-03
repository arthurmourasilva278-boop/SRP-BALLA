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

// --- 🌐 SERVIDOR WEB PARA O RENDER (MANTÉM O BOT ONLINE) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('SRP | BALLA Bot está online e operando perfeitamente!');
});

app.listen(PORT, () => {
  console.log(`Servidor web rodando na porta ${PORT}`);
});
// -------------------------------------------------------------------

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
const PREFIX = ";";
const ROLE_BOOSTER_ID = "1565957334507987054";
const WELCOME_CHANNEL_ID = "1565919892291584030";
const LEAVE_CHANNEL_ID = "1565919952215609524"; 
const OWNER_ID = "1230674913564823562"; 

// --- IDs DOS CANAIS DE RELATÓRIO ---
const CHANNEL_TICKET_NORMAL = "1566183608182509808";
const CHANNEL_TICKET_RECRUTAMENTO = "1566173997203202058";
const CHANNEL_TRANSFERENCIA = "1566158426097324122";

// --- Configuração da Armadilha (HoneyPot) e Exceções ---
const TRAP_CHANNEL_ID = "1565934311985782974";
const IMMUNE_USERS = [
    "1230674913564823562", 
    "1166477445008998433", 
    "1567076897639239790" // Bot de monitoramento
];

// --- 🚫 LISTA DE IDS BLACKLIST (PROIBIDOS DE ENTRAR) ---
const BLACKLISTED_USERS = [
    "1546909201643741187",
    "1537041179240173589"
];

// --- 🛡️ SISTEMA ANTI-RAID E PROTEÇÕES (Spam de Canais e Spam de Mensagens) ---
let antiRaidActive = true; 
const channelCreations = new Map();
const messageSpam = new Map(); // Controle para spam de mensagens
const activePoints = new Map();
const giveawayParticipants = new Map();

const CHANNEL_CREATION_LIMIT = 3; 
const CHANNEL_CREATION_TIME = 5000; 

const MESSAGE_SPAM_LIMIT = 5; // Número máximo de mensagens seguidas
const MESSAGE_SPAM_TIME = 4000; // Janela de tempo em milissegundos

// --- ⚡ DEFINIÇÃO DOS COMANDOS SLASH ---
const commands = [
    new SlashCommandBuilder().setName('alianca').setDescription('Envia a ficha de parceria/aliança.'),
    new SlashCommandBuilder().setName('xfac').setDescription('Envia a ficha de desafio Xfac.'),
    new SlashCommandBuilder().setName('transferencia').setDescription('Envia a ficha de transferência para a BALLA.'),
    new SlashCommandBuilder().setName('rec').setDescription('Envia a ficha de recrutamento oficial da BALLA.'),
    new SlashCommandBuilder()
        .setName('sorteio')
        .setDescription('Inicia um sorteio na quebrada.')
        .addStringOption(option => option.setName('premio').setDescription('O que vai ser sorteado?').setRequired(true))
        .addIntegerOption(option => option.setName('tempo').setDescription('Duração do sorteio em minutos').setRequired(true))
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Bot ${BOT_NAME} ligado com sucesso como ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('A registar comandos Slash globalmente...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Comandos Slash registados com sucesso!');
    } catch (error) {
        console.error('Erro ao registar comandos Slash:', error);
    }
});

// --- 👋 EVENTO DE BOAS-VINDAS E VERIFICAÇÃO DE BLACKLIST ---
client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;

    if (BLACKLISTED_USERS.includes(member.id)) {
        try {
            await member.ban({ reason: "Blacklist: Usuário proibido de entrar no servidor." });
            const alertChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID) || guild.systemChannel;
            if (alertChannel) {
                alertChannel.send(`🚨 **[SEGURANÇA]** O usuário banido **${member.user.tag}** (\`${member.id}\`) tentou entrar e foi **BANIDO** instantaneamente pela blacklist! 🔨⚡`);
            }
            return;
        } catch (e) {
            console.error("Erro ao banir usuário da blacklist:", e);
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

// --- 🚪 EVENTO DE SAÍDA / BANIMENTO DE MEMBROS ---
client.on('guildMemberRemove', async (member) => {
    const guild = member.guild;
    const channel = guild.channels.cache.get(LEAVE_CHANNEL_ID) || guild.channels.cache.get(WELCOME_CHANNEL_ID) || guild.systemChannel;
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
            .setDescription(`O usuário **${member.user.tag}** vacilou, quebrou as regras e foi **BANIDO** da nossa comunidade! 🔨⚡`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: BOT_NAME })
            .setTimestamp();

        channel.send({ embeds: [banEmbed] }).catch(() => {});
    } else {
        const leaveEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(`👋 MEMBRO SAIU`)
            .setDescription(`O usuário **${member.user.tag}** meteu o pé do servidor. Valeu pela caminhada e boa sorte no corre! 🤝`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: BOT_NAME })
            .setTimestamp();

        channel.send({ embeds: [leaveEmbed] }).catch(() => {});
    }
});

// --- 🛡️ PROTEÇÃO CONTRA CRIAÇÃO EM MASSA DE CANAIS ---
client.on('guildChannelCreate', async (channel) => {
    if (!antiRaidActive) return;
    const guild = channel.guild;

    try {
        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
        const channelLog = fetchedLogs.entries.first();
        if (!channelLog) return;

        const { executor } = channelLog;
        if (!executor || executor.bot || IMMUNE_USERS.includes(executor.id)) return;

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
                        .setTitle(`🚨 TENTARAM BUGAR A BASE E DANÇARAM! 🚨`)
                        .setDescription(`O comédia do **${executor.tag}** tentou criar canais em massa e tomou **BAN PERMANENTE**! ⚡`);
                    alertChannel.send({ embeds: [banEmbed] });
                }
            }
        }
    } catch (e) {
        console.error("Erro no anti-raid de canais:", e);
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!oldMember.premiumSince && newMember.premiumSince) {
        await newMember.roles.add(ROLE_BOOSTER_ID).catch(() => {});
    }
});

// --- 💬 COMANDOS, ANTI-SPAM DE MENSAGENS E CANAL ARMADILHA ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- 🛡️ SISTEMA ANTI-SPAM DE MENSAGENS (FLOOD) ---
    if (antiRaidActive && !IMMUNE_USERS.includes(message.author.id) && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const userId = message.author.id;
        const now = Date.now();

        if (!messageSpam.has(userId)) {
            messageSpam.set(userId, []);
        }

        const userMessages = messageSpam.get(userId);
        userMessages.push(now);

        const windowStart = now - MESSAGE_SPAM_TIME;
        const recentMessages = userMessages.filter(time => time > windowStart);
        messageSpam.set(userId, recentMessages);

        if (recentMessages.length >= MESSAGE_SPAM_LIMIT) {
            try {
                await message.delete().catch(() => {});
                if (message.member && message.member.kickable) {
                    await message.member.kick("Anti-Spam: Flood de mensagens no chat.");
                    const alertChannel = message.guild.channels.cache.get(WELCOME_CHANNEL_ID) || message.guild.systemChannel;
                    if (alertChannel) {
                        alertChannel.send(`🚨 **[ANTI-SPAM]** O usuário **${message.author.tag}** tentou floodar o chat e foi **EXPULSO**! ⚡`);
                    }
                }
            } catch (err) {
                console.error("Erro no anti-spam de mensagens:", err);
            }
            return;
        }
    }

    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'antiraid') {
            if (message.author.id !== OWNER_ID) {
                return message.reply("❌ **Acesso negado!** Só o chefe pode mexer na segurança da quebrada.");
            }
            const option = args[0]?.toLowerCase();
            if (option === 'off' || option === 'desativar') {
                antiRaidActive = false;
                return message.reply("⚠️ **Anti-Raid desligado!** A firma tá vulnerável, cuidado.");
            } else if (option === 'on' || option === 'ativar') {
                antiRaidActive = true;
                const ligadoEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(`🛡️ ESCUDO LIGADO! A FIRMA TÁ BLINDADA! 🛡️`)
                    .setDescription(`Anti-raid de canais e anti-spam de mensagens ativados.`);
                return message.reply({ embeds: [ligadoEmbed] });
            } else {
                return message.reply(`Situação do Anti-Raid: **${antiRaidActive ? 'ATIVADO ✅' : 'DESATIVADO ❌'}**\nManda \`;antiraid on\` para blindar ou \`;antiraid off\` para desativar.`);
            }
        }

        if (command === 'bateponto') {
            const embed = new EmbedBuilder()
                .setColor('#800080')
                .setTitle(`⏱️ Sistema de Bate-Ponto — ${BOT_NAME}`)
                .setDescription('Clique no botão abaixo para iniciar ou encerrar o seu ponto de serviço.');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ponto_iniciar').setLabel('Iniciar Ponto').setStyle(ButtonStyle.Success).setEmoji('🟢'),
                new ButtonBuilder().setCustomId('ponto_encerrar').setLabel('Encerrar Ponto').setStyle(ButtonStyle.Danger).setEmoji('🔴')
            );

            await message.channel.send({ embeds: [embed], components: [row] });
            await message.delete().catch(() => {});
            return;
        }

        if (command === 'painelticket') {
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
                .setFooter({ text: BOT_NAME });

            const optionsMenu = new StringSelectMenuBuilder()
                .setCustomId('menu_opcoes')
                .setPlaceholder('Opções')
                .addOptions([
                    { label: 'Falar com gestão', description: 'Tratar assuntos diretamente com a gestão', value: 'ticket_gestao', emoji: '🗣️' },
                    { label: 'Dúvidas', description: 'Tirar dúvidas gerais sobre a facção/servidor', value: 'ticket_duvidas', emoji: '❓' },
                    { label: 'Outros', description: 'Outros assuntos não especificados', value: 'ticket_outros', emoji: '📌' },
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
                    { label: 'Solicitar cargo', description: 'Pedir ou ajustar seus cargos/setor', value: 'ticket_solicitar_cargo', emoji: '🏷️' },
                    { label: 'Recrutamento', description: 'Informações para entrada na fac', value: 'ticket_recrutamento', emoji: '📥' }
                ]);

            const row1 = new ActionRowBuilder().addComponents(optionsMenu);
            const row2 = new ActionRowBuilder().addComponents(factionMenu);

            await message.channel.send({ embeds: [embed], components: [row1, row2] });
            await message.delete().catch(() => {});
            return;
        }

        // --- PAINEL DE TRANSFERÊNCIA COM DUAS OPÇÕES (BOT / MANUAL) ---
        if (command === 'paineltransferencia') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply("Apenas administradores podem usar este comando.");
            }

            const embed = new EmbedBuilder()
                .setColor('#800080')
                .setTitle(`🔄 Painel de Transferência — ${BOT_NAME}`)
                .setDescription('Escolha abaixo como deseja realizar o seu procedimento de transferência para a BALLA.');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('transfer_bot_send').setLabel('Bot enviar mensagem').setStyle(ButtonStyle.Primary).setEmoji('🤖'),
                new ButtonBuilder().setCustomId('transfer_manual').setLabel('Fazer manualmente').setStyle(ButtonStyle.Secondary).setEmoji('📝')
            );

            await message.channel.send({ embeds: [embed], components: [row] });
            await message.delete().catch(() => {});
            return;
        }

        if (command === 'regras') {
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
            return;
        }
    }

    // --- 🪤 CANAL ARMADILHA (HONEYPOT) COM EXCEÇÃO PARA OS IDs IMUNES ---
    if (message.channel.id === TRAP_CHANNEL_ID) {
        if (!IMMUNE_USERS.includes(message.author.id)) {
            try {
                await message.delete().catch(() => {});
                if (message.member && message.member.kickable) {
                    await message.member.kick("Digitou no canal armadilha (HoneyPot).");
                    
                    const logChannel = message.guild.channels.cache.get(WELCOME_CHANNEL_ID) || message.guild.systemChannel;
                    if (logChannel) {
                        logChannel.send(`🪤 **[ARMADILHA]** O usuário **${message.author.tag}** caiu na armadilha ao digitar no canal proibido e foi **EXPULSO**!`);
                    }
                }
            } catch (err) {}
            return;
        }
    }
});

// --- 🎯 TRATAMENTO DE INTERAÇÕES (COMANDOS SLASH, BOTÕES E MENUS) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'alianca') return await interaction.reply({ content: `PARCERIA 🤝\n\nNOME FAC:\n\nQUANTOS MEMBROS:\n\nFAC OFICIAL: \n\nLIDER:` });
        if (commandName === 'xfac') return await interaction.reply({ content: `# xfac\n\n> Fac:\n\n> Valor:\n\n> Horário:\n\n> Quantos v quantos:\n\n> Regras:\n\n> Local: \n\n> Melhor de quantos:` });
        if (commandName === 'transferencia') return await interaction.reply({ content: `TRANSFERÊNCIA PARA A BALLA\n\n**Olá, estarei realizando sua \ntransferência!\n\n> Seu Nick:\n\n> Sua facção:\n\n> Cargo desejado:\n\n> Provas/ print :**` });
        if (commandName === 'rec') return await interaction.reply({ content: `**RECRUTAMENTO | BALLA**\n\n📋 **IDENTIFICAÇÃO**\n\n👤 Nome:\n> \n\n🎂 Idade real:\n> \n\n🎮 Nick Roblox:\n> \n\n💬 Nick Discord:\n> \n\n⏰ Horário disponível:\n> \n\n🧁 Já participou de outra facção? Qual?\n> \n\n━━━━━━━━━━━━━━\n\n📜 **RP**\n\n🔫 RDM:\n> \n\n🕵️ CL:\n> \n\n🚗 VDM:\n> \n\n🌙 Dark RP:\n> \n\n🚫 Anti-RP:\n> \n\n━━━━━━━━━━━━━━\n\n👤 **PERFIL**\n\n🤿 O que é maturidade?\n> \n\n📊 Nota de maturidade (0-10):\n> \n\n Por que entrar no Gangue do ovo roxo ?\n> \n\n💪 Melhor qualidade:\n> \n\n⚠️ Maior defeito:\n> \n\n🚔 Como reagiria a uma abordagem policial no RP?\n> \n\n━━━━━━━━━━━━━━\n\n🎧 **EXTRAS**\n\n🎙️ Possui microfone?\n> \n\n🎮 Joga em equipe ou sozinho?\n> ` });

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
                .setDescription(
                    `🎁 **Prêmio:** **${premio}**\n\n` +
                    `👑 **Criado por:** ${interaction.user}\n` +
                    `⏰ **Termina em:** <t:${terminoTimestamp}:R> (<t:${terminoTimestamp}:f>)\n\n` +
                    `👇 Clica no botão abaixo para participar do corre!`
                )
                .setFooter({ text: `Participe e boa sorte!` })
                .setTimestamp();

            const giveawayRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('Participar')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎉')
            );

            await interaction.reply({ content: `✅ Sorteio iniciado com sucesso!`, ephemeral: true });
            const giveawayMessage = await interaction.channel.send({ embeds: [giveawayEmbed], components: [giveawayRow] });

            giveawayParticipants.set(giveawayMessage.id, new Set());

            setTimeout(async () => {
                const participantsSet = giveawayParticipants.get(giveawayMessage.id);
                const participantsArray = Array.from(participantsSet || []);

                if (participantsArray.length === 0) {
                    const endedEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle(`🎉 SORTEIO ENCERRADO — ${BOT_NAME} 🎉`)
                        .setDescription(`🎁 **Prêmio:** **${premio}**\n\n❌ **Nenhum maluco participou a tempo, sorteio cancelado!**`);
                    
                    await giveawayMessage.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
                    giveawayParticipants.delete(giveawayMessage.id);
                    return;
                }

                const winnerId = participantsArray[Math.floor(Math.random() * participantsArray.length)];
                const winnerUser = await interaction.guild.members.fetch(winnerId).catch(() => null);

                const winnerEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(`🎉 SORTEIO ENCERRADO! 🎉`)
                    .setDescription(
                        `🎁 **Prêmio:** **${premio}**\n\n` +
                        `🏆 **Vencedor:** ${winnerUser ? winnerUser : `<@${winnerId}>`}!\n\n` +
                        `Parabéns, mandou bem no corre e faturou o prêmio! 🚀🔥`
                    )
                    .setTimestamp();

                await giveawayMessage.edit({ embeds: [winnerEmbed], components: [] }).catch(() => {});
                await giveawayMessage.reply(`🎉 Parabéns ${winnerUser ? winnerUser : `<@${winnerId}>`}! Você ganhou o prêmio **${premio}**! Chama no corre para resgatar! 🏆🔥`);
                
                giveawayParticipants.delete(giveawayMessage.id);
            }, tempoMs);
        }
    }

    if (interaction.isButton()) {
        const userId = interaction.user.id;
        const guild = interaction.guild;
        const member = interaction.user;

        if (interaction.customId === 'join_giveaway') {
            const messageId = interaction.message.id;
            if (!giveawayParticipants.has(messageId)) {
                return await interaction.reply({ content: `❌ Este sorteio já terminou ou expirou!`, ephemeral: true });
            }

            const participantsSet = giveawayParticipants.get(messageId);
            if (participantsSet.has(userId)) {
                return await interaction.reply({ content: `⚠️ Você já está a participar deste sorteio! Fica tranquilo e aguarda o resultado.`, ephemeral: true });
            }

            participantsSet.add(userId);
            return await interaction.reply({ content: `✅ Participação garantida com sucesso! Boa sorte no sorteio! 🍀`, ephemeral: true });
        }

        // --- INTERAÇÃO DO PAINEL DE TRANSFERÊNCIA ---
        if (interaction.customId === 'transfer_bot_send' || interaction.customId === 'transfer_manual') {
            const channelName = `transferencia-${member.username.toLowerCase()}`;
            
            const existingChannel = guild.channels.cache.find(c => c.name === channelName);
            if (existingChannel) {
                return await interaction.reply({ content: `Você já possui um ticket de transferência aberto em ${existingChannel}!`, ephemeral: true });
            }

            try {
                const ticketChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                    ]
                });

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                const transferText = 
                    `# RELATÓRIO DE TRANSFERÊNCIA ⬇️\n` +
                    `> 🙋🏻Superior : \n\n` +
                    `> 🍬 Transferido : ${member}\n\n` +
                    `> ⭐ Cargo em outra fac : \n\n` +
                    `> ⭐ Cargo Entregado : \n\n` +
                    `> 📃 Provas : abaixo\n\n` +
                    `**Permissão**: <@&1559625846774300704>`;

                await ticketChannel.send({ content: `${member}\n${transferText}`, components: [closeRow] });

                const relatorioChannel = guild.channels.cache.get(CHANNEL_TRANSFERENCIA);
                if (relatorioChannel) {
                    relatorioChannel.send(`📂 **Novo Ticket de Transferência Aberto!**\n👤 Usuário: ${member} (\`${member.id}\`)\n📍 Canal: ${ticketChannel}`);
                }

                return await interaction.reply({ content: `✅ O seu ticket de transferência foi criado com sucesso: ${ticketChannel}`, ephemeral: true });
            } catch (err) {
                console.error(err);
                return await interaction.reply({ content: `❌ Ocorreu um erro ao criar o ticket de transferência.`, ephemeral: true });
            }
        }

        if (interaction.customId === 'ponto_iniciar') {
            const now = Date.now();
            const options = { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' };
            const dataFormatada = new Intl.DateTimeFormat('pt-BR', options).format(now);
            
            activePoints.set(userId, { startTime: now, startStr: dataFormatada });
            return await interaction.reply({ content: `🟢 Ponto iniciado com sucesso às **${dataFormatada}**!`, ephemeral: true });
        }

        if (interaction.customId === 'ponto_encerrar') {
            const now = Date.now();
            const options = { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' };
            const dataFormatada = new Intl.DateTimeFormat('pt-BR', options).format(now);

            const pontoData = activePoints.get(userId);
            if (!pontoData) {
                return await interaction.reply({ content: `❌ Você não iniciou nenhum ponto ainda! Clique em "Iniciar Ponto" primeiro.`, ephemeral: true });
            }

            const diffMs = now - pontoData.startTime;
            const diffSec = Math.floor(diffMs / 1000);
            const minutes = Math.floor(diffSec / 60);
            const hours = Math.floor(minutes / 60);
            const displayMin = minutes % 60;
            const displaySec = diffSec % 60;

            let tempoTotalStr = '';
            if (hours > 0) tempoTotalStr += `${hours} hora(s) `;
            if (displayMin > 0 || hours > 0) tempoTotalStr += `${displayMin} minuto(s) `;
            tempoTotalStr += `${displaySec} segundo(s)`;

            const pontoEmbed = new EmbedBuilder()
                .setColor('#800080')
                .setTitle(`⏱️ Registo de Ponto — ${BOT_NAME}`)
                .addFields(
                    { name: 'Usuário:', value: `${interaction.user}`, inline: false },
                    { name: 'Início:', value: `${pontoData.startStr}`, inline: false },
                    { name: 'Termino:', value: `${dataFormatada}`, inline: false },
                    { name: 'Tempo total:', value: `${tempoTotalStr}`, inline: false }
                )
                .setFooter({ text: BOT_NAME })
                .setTimestamp();

            activePoints.delete(userId);
            return await interaction.reply({ embeds: [pontoEmbed] });
        }

        if (interaction.customId === 'close_ticket') {
            const channel = interaction.channel;
            await interaction.reply({ content: '🔒 Fechando ticket em 5 segundos...' });
            setTimeout(() => {
                channel.delete().catch(() => {});
            }, 5000);
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
                .setTitle(`Ticket: ${ticketType.toUpperCase().replace('_', ' ')}`)
                .setDescription(`Olá ${member}, seu ticket foi aberto com sucesso!\nExplique o motivo do seu contato e aguarde a equipe responsável (${BOT_NAME}).`);

            await ticketChannel.send({ content: `${member}`, embeds: [openedEmbed], components: [closeRow] });
            await interaction.reply({ content: `✅ Seu ticket foi aberto em: ${ticketChannel}`, ephemeral: true });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Ocorreu um erro ao criar o seu ticket.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

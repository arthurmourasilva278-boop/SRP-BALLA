 
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

// Configuração da Armadilha
const TRAP_CHANNEL_ID = "1565934311985782974";
const IMMUNE_USER_ID = "1166477445008998433";

// --- 🛡️ SISTEMA ANTI-RAID AVANÇADO ---
let antiRaidActive = true; 
const recentJoins = new Map();
const channelCreations = new Map();
const activePoints = new Map();

const ANTI_RAID_LIMIT = 5;       
const ANTI_RAID_TIME = 10000;    
const MIN_ACCOUNT_AGE = 7 * 24 * 60 * 60 * 1000; 
const CHANNEL_CREATION_LIMIT = 3; 
const CHANNEL_CREATION_TIME = 5000; 

// --- ⚡ DEFINIÇÃO DOS COMANDOS SLASH ---
const commands = [
    new SlashCommandBuilder().setName('alianca').setDescription('Envia a ficha de parceria/aliança.'),
    new SlashCommandBuilder().setName('xfac').setDescription('Envia a ficha de desafio Xfac.'),
    new SlashCommandBuilder().setName('transferencia').setDescription('Envia a ficha de transferência para a BALLA.'),
    new SlashCommandBuilder().setName('rec').setDescription('Envia a ficha de recrutamento oficial da BALLA.')
].map(command => command.toJSON());

client.once('clientReady', async () => {
    console.log(`Bot ${BOT_NAME} ligado com sucesso como ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('A registrar comandos Slash (/)...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Comandos Slash registados com sucesso!');
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
                await member.kick("Anti-Raid: Conta muito nova.");
                const logChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID) || guild.systemChannel;
                if (logChannel) {
                    logChannel.send({ embeds: [new EmbedBuilder().setColor('#FF0000').setTitle(`🚨 TRETAS DETECTADAS!`).setDescription(`Anti-raid ativado. Quem tentar não vai conseguir, vai ser kickado na hora e vai tomar.\n\n> **Maluco barrado:** ${member.user.tag}`)] });
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
            .setDescription(`E aí ${member}! Salve, salve! É uma honra ter você com a gente.\n\nAproveite a estadia e bom jogo! 🤝🔥`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        welcomeChannel.send({ content: `👋 Salve ${member}!`, embeds: [welcomeEmbed] });
    }
});

// --- 🚪 SAÍDA / BANIMENTO ---
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
        channel.send({ embeds: [new EmbedBuilder().setColor('#FF0000').setTitle(`⛔ MEMBRO BANIDO!`).setDescription(`O usuário **${member.user.tag}** vacilou e foi **BANIDO**! 🔨⚡`)] }).catch(() => {});
    } else {
        channel.send({ embeds: [new EmbedBuilder().setColor('#FFA500').setTitle(`👋 MEMBRO SAIU`).setDescription(`O usuário **${member.user.tag}** meteu o pé do servidor. Valeu pela caminhada! 🤝`)] }).catch(() => {});
    }
});

// --- MENSAGENS E COMANDOS COM '+' ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    console.log(`Mensagem recebida de ${message.author.tag}: ${message.content}`);

    // Canal Armadilha (HoneyPot)
    if (message.channel.id === TRAP_CHANNEL_ID) {
        if (message.author.id !== IMMUNE_USER_ID) {
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

    // Comando +antiraid
    if (message.content.startsWith('+antiraid')) {
        if (message.author.id !== OWNER_ID) {
            return message.reply("❌ **Acesso negado!** Só o chefe pode mexer na segurança da quebrada.");
        }
        const args = message.content.split(' ');
        const option = args[1]?.toLowerCase();

        if (option === 'off' || option === 'desativar') {
            antiRaidActive = false;
            return message.reply("⚠️ **Anti-Raid desligado!**");
        } else if (option === 'on' || option === 'ativar') {
            antiRaidActive = true;
            return message.reply({ embeds: [new EmbedBuilder().setColor('#00FF00').setTitle(`🛡️ ESCUDO LIGADO!`).setDescription(`Anti-raid ativado. Quem tentar não vai conseguir, vai ser kickado na hora e vai tomar.`)] });
        } else {
            return message.reply(`Situação do Anti-Raid: **${antiRaidActive ? 'ATIVADO ✅' : 'DESATIVADO ❌'}**`);
        }
    }

    // Comando +bateponto
    if (message.content === '+bateponto') {
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
    }

    // Comando +painelticket
    if (message.content === '+painelticket') {
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
    }

    // Comando +regras
    if (message.content === '+regras') {
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

// --- INTERAÇÕES (SLASH, BOTÕES E MENUS) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        if (commandName === 'alianca') return await interaction.reply({ content: `PARCERIA 🤝\n\nNOME FAC:\n\nQUANTOS MEMBROS:\n\nFAC OFICIAL: \n\nLIDER:` });
        if (commandName === 'xfac') return await interaction.reply({ content: `# xfac\n\n> Fac:\n\n> Valor:\n\n> Horário:\n\n> Quantos v quantos:\n\n> Regras:\n\n> Local: \n\n> Melhor de quantos:` });
        if (commandName === 'transferencia') return await interaction.reply({ content: `TRANSFERÊNCIA PARA A BALLA\n\n**Olá, estarei realizando sua \ntransferência!\n\n> Seu Nick:\n\n> Sua facção:\n\n> Cargo desejado:\n\n> Provas/ print :**` });
        if (commandName === 'rec') return await interaction.reply({ content: `**RECRUTAMENTO | BALLA**\n\n📋 **IDENTIFICAÇÃO**\n\n👤 Nome:\n> \n\n🎂 Idade real:\n> \n\n🎮 Nick Roblox:\n> \n\n💬 Nick Discord:\n> \n\n⏰ Horário disponível:\n> \n\n🧁 Já participou de outra facção? Qual?\n> \n\n━━━━━━━━━━━━━━\n\n📜 **RP**\n\n🔫 RDM:\n> \n\n🕵️ CL:\n> \n\n🚗 VDM:\n> \n\n🌙 Dark RP:\n> \n\n🚫 Anti-RP:\n> \n\n━━━━━━━━━━━━━━\n\n👤 **PERFIL**\n\n🤿 O que é maturidade?\n> \n\n📊 Nota de maturidade (0-10):\n> \n\n Por que entrar no Gangue do ovo roxo ?\n> \n\n💪 Melhor qualidade:\n> \n\n⚠️ Maior defeito:\n> \n\n🚔 Como reagiria a uma abordagem policial no RP?\n> \n\n━━━━━━━━━━━━━━\n\n🎧 **EXTRAS**\n\n🎙️ Possui microfone?\n> \n\n🎮 Joga em equipe ou sozinho?\n> ` });
    }

    if (interaction.isButton()) {
        const userId = interaction.user.id;
        const now = Date.now();
        const options = { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' };
        const dataFormatada = new Intl.DateTimeFormat('pt-BR', options).format(now);

        if (interaction.customId === 'ponto_iniciar') {
            activePoints.set(userId, { startTime: now, startStr: dataFormatada });
            return await interaction.reply({ content: `🟢 Ponto iniciado com sucesso às **${dataFormatada}**!`, ephemeral: true });
        }

        if (interaction.customId === 'ponto_encerrar') {
            const pontoData = activePoints.get(userId);
            if (!pontoData) return await interaction.reply({ content: `❌ Você não iniciou nenhum ponto ainda!`, ephemeral: true });

            const diffMs = now - pontoData.startTime;
            const diffSec = Math.floor(diffMs / 1000);
            const minutes = Math.floor(diffSec / 60);
            const hours = Math.floor(minutes / 60);

            const pontoEmbed = new EmbedBuilder()
                .setColor('#800080')
                .setTitle(`⏱️ Registo de Ponto — ${BOT_NAME}`)
                .addFields(
                    { name: 'Usuário:', value: `${interaction.user}` },
                    { name: 'Início:', value: `${pontoData.startStr}` },
                    { name: 'Termino:', value: `${dataFormatada}` },
                    { name: 'Tempo total:', value: `${hours}h ${minutes % 60}m ${diffSec % 60}s` }
                )
                .setFooter({ text: `Sistema desenvolvido pela krozz • ${BOT_NAME}` })
                .setTimestamp();

            activePoints.delete(userId);
            return await interaction.reply({ embeds: [pontoEmbed] });
        }

        if (interaction.customId === 'close_ticket') {
            const channel = interaction.channel;
            await interaction.reply({ content: '🔒 Fechando ticket em 5 segundos...' });
            setTimeout(() => channel.delete().catch(() => {}), 5000);
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

            const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
            const openedEmbed = new EmbedBuilder().setColor('#800080').setTitle(`Ticket: ${ticketType.toUpperCase().replace('_', ' ')}`).setDescription(`Olá ${member}, seu ticket foi aberto com sucesso!\nExplique o motivo do seu contato e aguarde a equipe responsável (${BOT_NAME}).`);

            await ticketChannel.send({ content: `${member}`, embeds: [openedEmbed], components: [closeRow] });
            await interaction.reply({ content: `✅ Seu ticket foi aberto em: ${ticketChannel}`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: '❌ Ocorreu um erro ao criar o seu ticket.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);


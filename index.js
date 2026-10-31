
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionsBitField, 
    ChannelType 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const activePontoSessions = new Map();
let antiRaidEnabled = false;

client.on('ready', () => {
    console.log(`Bot online: ${client.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
    if (antiRaidEnabled) {
        try {
            await member.kick('Anti-Raid ativo: Tentativa de invasão bloqueada.');
            return;
        } catch (err) {
            console.error(`Erro ao expulsar membro no Anti-Raid:`, err);
        }
    }

    const welcomeChannel = member.guild.channels.cache.find(ch => ch.name.includes('boas-vindas'));
    if (welcomeChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`Bem-vindo(a) à SRP | BALLA!`)
            .setDescription(`Olá ${member}, seja bem-vindo ao servidor da nossa facção.`)
            .setColor('#7000FF')
            .setTimestamp();
        welcomeChannel.send({ embeds: [welcomeEmbed] });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'antiraid') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('Sem permissão para usar este comando.');
        }
        if (args[0] === 'on') {
            antiRaidEnabled = true;
            return message.reply('🛡️ **Anti-Raid ATIVADO!** O próximo que tentar raidar vai tomar kick!');
        } else if (args[0] === 'off') {
            antiRaidEnabled = false;
            return message.reply('🛡️ **Anti-Raid desativado.**');
        } else {
            return message.reply(`Status atual: **${antiRaidEnabled ? 'ON' : 'OFF'}**. Use \`!antiraid on\` ou \`!antiraid off\`.`);
        }
    }

    if (command === 'regras') {
        const regrasEmbed = new EmbedBuilder()
            .setTitle('————————• REGRAS •—————————')
            .setColor('#800080')
            .setDescription(
                '• Proibido racismo\n• Proibido Gordofobia\n• Proibido Xenofobia\n' +
                '• Sem nenhum tipo de preconceito\n• Respeitar a hierarquia\n' +
                '• Respeitar os canais\n• Não sair do personagem\n• Siga as regras do RP'
            );
        const punicoesEmbed = new EmbedBuilder()
            .setTitle('————————• Punições •—————————')
            .setColor('#FF0000')
            .setDescription(
                '• Preconceitos: 1 a 7 dias (racismo é perm)\n• xingar sem motivo: adv ( 1/3 )\n' +
                '• Não respeitar a hierarquia: adv ( 1/3 )\n• Não seguir as regras do rp: Castigo ( 1/3 ) , 1h pronto.'
            );
        return message.channel.send({ embeds: [regrasEmbed, punicoesEmbed] });
    }

    if (command === 'painelticket') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const embed = new EmbedBuilder()
            .setColor('#800080')
            .setTitle('🎟️ Central de Atendimento - SRP | BALLA')
            .setDescription('Selecione abaixo o motivo do seu atendimento no menu:');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('Selecione o motivo do atendimento')
            .addOptions([
                { label: 'Xfac', value: 'ticket_xfac', emoji: '🤝' },
                { label: 'Transferência', value: 'ticket_transferencia', emoji: '🔄' },
                { label: 'Pagar Metas', value: 'ticket_pagarmetas', emoji: '💰' },
                { label: 'Sugestão', value: 'ticket_sugestao', emoji: '💡' },
                { label: 'Alianças', value: 'ticket_aliancas', emoji: '🛡️' },
                { label: 'Setagem', value: 'ticket_setagem', emoji: '⚙️' },
                { label: 'Recrutamento', value: 'ticket_recrutamento', emoji: '📥' },
                { label: 'Denúncias', value: 'ticket_denuncias', emoji: '🚨' },
                { label: 'Booster', value: 'ticket_booster', emoji: '🚀' }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);
        return message.channel.send({ embeds: [embed], components: [row] });
    }

    if (command === 'painelponto') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const embed = new EmbedBuilder()
            .setTitle('⏱️ Sistema de Ponto - SRP | BALLA')
            .setDescription('Clique nos botões abaixo para entrar ou sair do ponto na call.')
            .setColor('#00FF00');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ponto_in').setLabel('Entrar no Ponto').setStyle(ButtonStyle.Success).setEmoji('🟢'),
            new ButtonBuilder().setCustomId('ponto_out').setLabel('Sair do Ponto').setStyle(ButtonStyle.Danger).setEmoji('🔴')
        );

        return message.channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const ticketType = interaction.values[0].replace('ticket_', '');
        const channelName = `${ticketType}-${interaction.user.username}`;
        
        const existing = interaction.guild.channels.cache.find(c => c.name === channelName);
        if (existing) return interaction.reply({ content: 'Você já tem um ticket aberto!', ephemeral: true });

        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({ content: `${interaction.user}`, embeds: [new EmbedBuilder().setTitle(`Ticket: ${ticketType.toUpperCase()}`).setDescription('Explique o motivo do contato.')], components: [closeRow] });
        return interaction.reply({ content: `Ticket aberto: ${channel}`, ephemeral: true });
    }

    if (interaction.isButton()) {
        const member = interaction.member;

        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 Fechando ticket em 5 segundos...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

        if (interaction.customId === 'ponto_in') {
            if (!member.voice.channel) return interaction.reply({ content: '❌ Entre em uma call primeiro!', ephemeral: true });
            if (activePontoSessions.has(member.id)) return interaction.reply({ content: '⚠️ Ponto já está ativo.', ephemeral: true });

            activePontoSessions.set(member.id, { startTime: new Date(), channelId: member.voice.channel.id });
            return interaction.reply({ content: '🟢 Ponto iniciado!', ephemeral: true });
        }

        if (interaction.customId === 'ponto_out') {
            const session = activePontoSessions.get(member.id);
            if (!session) return interaction.reply({ content: '❌ Você não bateu ponto.', ephemeral: true });

            const duration = Math.floor((new Date() - session.startTime) / 60000);
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;

            activePontoSessions.delete(member.id);
            return interaction.reply({ content: `🔴 Ponto encerrado! Tempo: ${hours}h e ${minutes}m.`, ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);


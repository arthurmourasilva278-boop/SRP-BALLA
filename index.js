const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField 
} = require('discord.js');

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
const WELCOME_CHANNEL_ID = "SEU_CANAL_DE_BEM_VINDO_ID"; // Substitua pelo ID do canal de bem-vindo

// 👑 COLOQUE O SEU ID DO DISCORD AQUI (Somente você poderá ativar/desativar o Anti-Raid):
const OWNER_ID = "SEU_ID_DE_DONO_AQUI"; 

// --- 🛡️ SISTEMA ANTI-RAID AVANÇADO ---
let antiRaidActive = true; // Status do Anti-Raid (Ativado por padrão)
const recentJoins = new Map();
const ANTI_RAID_LIMIT = 5;       // Número máximo de entradas permitidas
const ANTI_RAID_TIME = 10000;    // Janela de tempo em milissegundos (10 segundos)
const MIN_ACCOUNT_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms (contas novas suspeitas)

client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    const now = Date.now();

    // 🛡️ VERIFICA SE O ANTI-RAID ESTÁ ATIVADO PELO DONO
    if (antiRaidActive) {
        // 1. ANÁLISE DE CONTA NOVA (Anti-Alt/Bot)
        const accountAge = now - member.user.createdTimestamp;
        if (accountAge < MIN_ACCOUNT_AGE) {
            try {
                await member.kick("Anti-Raid Avançado: Conta muito nova (suspeita de bot/raid).");
                
                const logChannel = guild.systemChannel;
                if (logChannel) {
                    logChannel.send(`🛡️ **[ANTI-RAID]** Conta suspeita bloqueada automaticamente: **${member.user.tag}** (Criada há menos de 7 dias).`);
                }
                return; // Interrompe para não mandar boas-vindas nem dar cargos
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
            const alertChannel = guild.systemChannel;
            if (alertChannel) {
                const raidEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`🚨 ALERTA MÁXIMO DE RAID DETECTADA! 🚨`)
                    .setDescription(`O sistema detectou um fluxo anormal de entradas (**${recent.length} membros** em poucos segundos).\nO servidor entrou em **Modo de Proteção Preventiva**!`)
                    .setTimestamp();
                
                alertChannel.send({ embeds: [raidEmbed] });
            }

            try {
                await guild.setVerificationLevel(4); // Eleva a segurança do servidor
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

client.once('ready', () => {
    console.log(`Bot ${BOT_NAME} ligado com segurança avançada como ${client.user.tag}!`);
});

// --- COMANDOS DO BOT ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 🔒 COMANDO EXCLUSIVO DO DONO PARA LIGAR/DESLIGAR O ANTI-RAID
    if (message.content.startsWith('!antiraid')) {
        if (message.author.id !== OWNER_ID) {
            return message.reply("❌ **Acesso negado!** Apenas o dono do bot pode alterar as configurações do Anti-Raid.");
        }

        const args = message.content.split(' ');
        const option = args[1]?.toLowerCase();

        if (option === 'off' || option === 'desativar') {
            antiRaidActive = false;
            return message.reply("🛡️ **Anti-Raid foi DESATIVADO** com sucesso pelo dono do bot.");
        } else if (option === 'on' || option === 'ativar') {
            antiRaidActive = true;
            return message.reply("🛡️ **Anti-Raid foi ATIVADO** com sucesso pelo dono do bot.");
        } else {
            return message.reply(`Status atual do Anti-Raid: **${antiRaidActive ? 'ATIVADO ✅' : 'DESATIVADO ❌'}**\nUse \`!antiraid on\` para ativar ou \`!antiraid off\` para desativar.`);
        }
    }

    // Comando !painelticket
    if (message.content === '!painelticket') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Apenas administradores podem usar este comando.");
        }

        const embed = new EmbedBuilder()
            .setColor('#800080')
            .setTitle(`🎟️ Central de Atendimento — ${BOT_NAME}`)
            .setDescription('Selecione abaixo o motivo do seu atendimento clicando no botão correspondente:\n\n' +
                          '• **Xfac** (Negociações/Acordos)\n' +
                          '• **Transferência** (Mudança de fac/setor)\n' +
                          '• **Pagar Metas** (Envio de provas de metas)\n' +
                          '• **Sugestão** (Ideias para melhoria)\n' +
                          '• **Alianças** (Parcerias)\n' +
                          '• **Setagem** (Ajustes de cargos/setor)\n' +
                          '• **Recrutamento** (Entrada na fac)\n' +
                          '• **Denúncias** (Reportar infrações)\n' +
                          '• **Booster** (Benefícios de impulsionador)')
            .setFooter({ text: BOT_NAME });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_xfac').setLabel('Xfac').setStyle(ButtonStyle.Primary).setEmoji('🤝'),
            new ButtonBuilder().setCustomId('ticket_transferencia').setLabel('Transferência').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('ticket_pagarmetas').setLabel('Pagar Metas').setStyle(ButtonStyle.Success).setEmoji('💰'),
            new ButtonBuilder().setCustomId('ticket_sugestao').setLabel('Sugestão').setStyle(ButtonStyle.Secondary).setEmoji('💡')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_aliancas').setLabel('Alianças').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('ticket_setagem').setLabel('Setagem').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
            new ButtonBuilder().setCustomId('ticket_recrutamento').setLabel('Recrutamento').setStyle(ButtonStyle.Success).setEmoji('📥'),
            new ButtonBuilder().setCustomId('ticket_denuncias').setLabel('Denúncias').setStyle(ButtonStyle.Danger).setEmoji('🚨'),
            new ButtonBuilder().setCustomId('ticket_booster').setLabel('Booster').setStyle(ButtonStyle.Primary).setEmoji('🚀')
        );

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

// --- INTERAÇÃO DOS BOTÕES DE TICKET ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('ticket_')) {
        const ticketType = interaction.customId.replace('ticket_', '');
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

    if (interaction.customId === 'close_ticket') {
        const channel = interaction.channel;
        await interaction.reply({ content: '🔒 Fechando ticket em 5 segundos...' });
        setTimeout(() => {
            channel.delete().catch(() => {});
        }, 5000);
    }
});

// Insira o token do seu bot abaixo
client.login(process.env.DISCORD_TOKEN)




const {players, realName} = require('./participants-players');
const {league, LP, rankLeague} = require('./rank-stats');
const _ = require('underscore');
require('dotenv').config();

const channelID = process.env.CHANNEL_ID;
const roleID = process.env.ROLE_ID;
const {Client, MessageEmbed} = require('discord.js');
const bot = new Client();


const prefix = '!';

const axios = require('axios');

bot.login(process.env.DISCORD_TOKEN);

bot.on('ready', () => console.log('im ready'));

async function fetchApi() {
    const r = await Promise.all(players.map(async nickName => {
        const summoner = await axios.get(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${nickName}?api_key=${process.env.RIOT_API}`)
            .then(r => {
                return r.data;
            });
        return summoner.id;
    }));
    return await Promise.all(r.map(async summonerID => {
            return await axios.get(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerID}?api_key=${process.env.RIOT_API}`)
                .then(r => r.data);
        })
    );
}

bot.on('message', async message => {
    if (message.channel.id !== channelID) return;
    let msg = message.content.toUpperCase();
    if (msg.startsWith(prefix + 'RANK')) {
        message.delete().catch();
        const accountDetails = await fetchApi();
        let data = [];
        accountDetails.map(arrayAcc => {
            arrayAcc.map(r => {
                if (r.queueType === 'RANKED_SOLO_5x5') {
                    data.push({
                        tier: r.tier,
                        rank: r.rank,
                        user: r.summonerName,
                        lps: r.leaguePoints,
                        wins: r.wins,
                        losses: r.losses
                    });
                }
            });
        });
        const sortedData = sortSoloQRank(data);
        const embed = new MessageEmbed()
            .setColor('RANDOM')
            .setTitle('Estado actual del Challenge');
        sortedData.map((d, i) => {
            embed.addField(`Puesto #${i + 1} ${realName[players.indexOf(d.user)]}`, `${d.user} ${d.tier} ${d.rank} ${d.lps}LP ${parseFloat((d.wins * 100) / (d.wins + d.losses)).toFixed(2)}% winrate`);
        });
        message.channel.send(embed);
    }
    if (msg.startsWith(prefix + 'PURGE')) {
        message.delete().catch();
        if (!message.member.hasPermission('MANAGE_MESSAGES')) return message.reply('off');
        message.channel.bulkDelete(15).then(() => {
            message.reply(`Se han eliminado 15 mensajes`).then(msg => msg.delete({timeout: 5000}));
        }).catch(r => message.reply('Hay mensajes que no puedo eliminar. Solo pueden ser eliminados mensajes con antigüedad inferior a 14 días').then(msg => msg.delete({timeout: 2000})));
    }
    if (msg.startsWith(prefix + 'ADDSOLOQ')) {
        message.delete().catch();
        let text = message.content.substr(10);
        let args = text.split(',');
        args.map(u => {
            if (u.indexOf('(') === -1 || u.indexOf(')') === -1) {
                message.reply('Todos los integrantes deben tener un nombre para identificar')
                    .then(msg => msg.default({timeout: 5000}));
            } else {
                players.push(u.substr(0, u.indexOf('(')));
                const lastKey = parseInt(Object.keys(realName)[Object.keys(realName).length - 1]) + 1;
                realName[lastKey] = u.substring(u.lastIndexOf('(') + 1, u.lastIndexOf(')'));
            }
        });
        if (message.member.roles.cache.find(r => r.id === roleID)) {
            message.reply('Se ha añadido nuevos usuario al challenge').then(msg => msg.delete({timeout: 2000}));
        } else {
            message.reply('No tienes permisos para usar este comando');
        }
    }
    // if (msg.startsWith(prefix + 'DELSOLOQ')) {
    //     message.delete().catch();
    //
    //     message.reply('ESTE COMANDO NO ESTÁ DISPONIBLE')
    //         .then(msg => msg.delete({timeout: 50000}));
    //     return ;
    //     let text = message.content.substr(10);
    //     let args = text.split(',');
    //     if (message.member.roles.cache.find(r => r.id === roleID)) {
    //         args.map(nick => {
    //             let index = players.indexOf(nick);
    //             players.splice(index, 1);
    //         });
    //
    //         message.reply('Se ha eliminado el/los usuario/s del challenge').then(msg => msg.delete({timeout: 2000}));
    //     } else {
    //         message.reply('No tienes permisos para usar este comando');
    //     }
    // }
});


function sortSoloQRank(arrayOfAccounts) {
    _.map(arrayOfAccounts, (details) => {
        const indexLeague = league.indexOf(details.tier.toLowerCase());
        const leaguePoints = rankLeague.indexOf(details.rank);
        const soloQPoints = LP[indexLeague] + leaguePoints + details.lps;
        _.extend(details, {soloQ: soloQPoints});
    });

    return arrayOfAccounts.sort(dynamicSort('soloQ', 'desc'));
}

function dynamicSort(property, order) {
    var sort_order = 1;
    if (order === 'desc') {
        sort_order = -1;
    }
    return function (a, b) {
        if (a[property] < b[property]) {
            return -1 * sort_order;
        } else if (a[property] > b[property]) {
            return 1 * sort_order;
        } else {
            return 0;
        }
    };
}

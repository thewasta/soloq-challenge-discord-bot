const {league, LP, rankLeague, leaguePeaks} = require('./rank-stats');
const _ = require('underscore');
require('dotenv').config();
const fs = require('fs');
const date = new Date();
const channelID = process.env.CHANNEL_ID;
const roleID = process.env.ROLE_ID;
const {Client, MessageEmbed} = require('discord.js');
const bot = new Client();
const Sentry = require('@sentry/node');
Sentry.init({dsn: process.env.SENTRY_DSN});

const prefix = '!';
const axios = require('axios');

bot.login(process.env.DISCORD_TOKEN);

bot.on('ready', () => console.log('im ready'));

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchApi() {
    const headers = {
        'Content-Type': 'application/json'
    };
    const arrayOfPlayer = fs.readFileSync('player-soloq.txt', 'utf8').replace(/\s/g, '').split(',');
    let nicksInGame = [];
    arrayOfPlayer.map(player => {
        const nickInGame = player.substr(0, player.indexOf('(')).trim();
        nicksInGame.push(nickInGame);
    });
    const summonersID = await Promise.all(nicksInGame.map(async nickName => {
        if (nickName.length !== 0) {
            const summoner = await axios.get(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${nickName}?api_key=${process.env.RIOT_API}`, {headers})
                .then(response => {
                    return response.data;
                });
            return summoner.id;
        }
    }));

    return await Promise.all(summonersID.map(async summonerID => {
            await sleep(3000);
            return await axios.get(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerID}?api_key=${process.env.RIOT_API}`)
                .then(response => response.data).catch(err => console.log('error en segundo fetch a la api de Riot', err));
        })
    );
}

bot.on('message', async message => {
    if (process.env.ENV === 'dev') message.delete({timeout: 3000}).catch();
    if (message.channel.id !== channelID) return;
    let msg = message.content.toUpperCase();
    if (msg.startsWith(prefix + 'RANK')) {
        const arrayOfPlayer = fs.readFileSync('player-soloq.txt', 'utf8').trim().split(',');
        let nicksInGame = [];
        let IDsNameInPreview = [];
        arrayOfPlayer.map(player => {
            const nickInGame = player.substr(0, player.indexOf('(')).trim();
            const IDNameInPreview = player.substring(player.indexOf('(') + 1, player.indexOf(')')).trim();
            nicksInGame.push(nickInGame);
            IDsNameInPreview.push(IDNameInPreview);
        });
        createFileToWrite('logs-system.log', formatDate(message.author, 'RANK', message.content), true);
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
        sortedData.map((d, index) => {
            embed.addField(`Puesto #${index + 1} ${IDsNameInPreview[nicksInGame.indexOf(encodeURI(d.user))]}`, `${d.user} ${d.tier} ${d.rank} ${d.lps}LP ${parseFloat((d.wins * 100) / (d.wins + d.losses)).toFixed(2)}% winrate -- ${d.wins + d.losses} partidas`);
        });
        message.channel.send(embed);
    }
    if (msg.startsWith(prefix + 'PURGE')) {
        createFileToWrite('logs-system.log', formatDate(message.author, 'PURGE', message.content), true);
        message.delete().catch();
        if (!message.member.hasPermission('MANAGE_MESSAGES')) return message.reply('off');
        message.channel.bulkDelete(15).then(() => {
            message.reply(`Se han eliminado 15 mensajes`).then(msg => msg.delete({timeout: 5000}));
        }).catch(r => message.reply('Hay mensajes que no puedo eliminar. Solo pueden ser eliminados mensajes con antigüedad inferior a 14 días').then(msg => msg.delete({timeout: 2000})));
    }
    if (!message.member.roles.cache.find(r => r.id === roleID)) return;
    if (msg.startsWith(prefix + 'ADDSOLOQ')) {
        createFileToWrite('logs-system.log', formatDate(message.author, 'ADDSOLOQ', message.content), true);
        message.delete().catch();
        let text = message.content.substr(10);
        let args = text.split(',');
        args.map(playerInfo => {
            if (playerInfo.indexOf('(') === -1 || playerInfo.indexOf(')') === -1) {
                message.reply(`Todos los usuarios deben tener un nick para ser Identificados`);
                return;
            }
            playerInfo = encodeURI(playerInfo.trim());
            createFileToWrite('player-soloq.txt', playerInfo);
            playerInfo = decodeURI(playerInfo);
            message.reply(`Se ha añadido al Challenge a: ${playerInfo}`);
        });
        /*args.map(u => {
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
        }*/
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
        const soloQPoints = LP[indexLeague] + leaguePeaks[leaguePoints] + details.lps;
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

function createFileToWrite(file, content, logs) {
    if (fs.existsSync(file)) {
        if (logs) {
            content = '\n' + content;
        } else {
            content = ',' + content;
        }
        fs.appendFileSync(file, content);
    } else {
        fs.writeFile(file, content, (err) => {
            if (err) return console.log(err);
        });
    }
}

function formatDate(msg, command, content) {
    const author = msg.username;
    const H = date.getHours();
    const M = date.getMinutes();
    const S = date.getSeconds();
    const MM = date.getMonth();
    const YY = date.getUTCFullYear();
    const DD = date.getUTCDay();
    return `Command [${command}] with message [${content}] sent by ${author} at ${H}:${M}:${S} ${YY}-${MM}-${DD}`;
}

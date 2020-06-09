const league = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];

const LP = {
    0: 0,
    1: 300,
    2: 900,
    3: 1500,
    4: 2100,
    5: 2700
};

const rankLeague = ['IV', 'III', 'II', 'I'];

const leaguePeaks = {
    0: 0, // IV
    1: 100, // II
    2: 200, // II
    3: 300, // I
};

module.exports.league = league;
module.exports.rankLeague = rankLeague;
module.exports.LP = LP;
module.exports.leaguePeaks = leaguePeaks;

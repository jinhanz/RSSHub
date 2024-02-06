const got = require('@/utils/got');
const config = require('@/config').value;
const { art } = require('@/utils/render');
const path = require('path');

const headers = {
    cookie: config.ncm.cookies,
    Referer: 'https://music.163.com/',
};

function getItem(records) {
    if (!records || records.length === 0) {
        return [{
            title: '暂无听歌排行',
        }, ];
    }

    return records.filter((record) => { // filter out songs with few plays
        if (record.playCount < 2) {
            return false; // skip
        }
        return true;
    }).map((record, index) => {
        const song = record.song;

        const artists_paintext = song.ar.map((a) => a.name).join('/');

        const html = art(path.join(__dirname, '../templates/music/userplayrecords.art'), {
            index,
            record,
            song,
        });

        return {
            title: `[${index + 1}] ${song.name} - ${artists_paintext}`,
            link: `http://music.163.com/song?id=${song.id}`,
            author: artists_paintext,
            description: html,
        };
    });
}

module.exports = async (ctx) => {
    const uid = ctx.params.uid;
    const type = Number.parseInt(ctx.params.type) || 0;

    const url = `https://music.163.com/api/v1/play/record?uid=${uid}&type=${type}`;
    const response = await got(url, { headers });

    const records = type === 1 ? response.data.weekData : response.data.allData;

    const items = getItem(records).slice(0, 10); // Get top 10 only

    ctx.state.data = {
        title: `${type === 1 ? '听歌榜单（最近一周）' : '听歌榜单（所有时间}'} - ${uid}}`,
        link: `https://music.163.com/user/home?id=${uid}`,
        updated: response.headers.date,
    };
};

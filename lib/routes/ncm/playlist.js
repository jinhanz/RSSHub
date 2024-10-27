const got = require('@/utils/got');
const config = require('@/config').value;

module.exports = async (ctx) => {
    const id = ctx.params.id;

    const response = await got({
        method: 'post',
        url: 'https://music.163.com/api/v3/playlist/detail',
        headers: {
            Referer: 'https://music.163.com/',
            Cookie: config.ncm.cookies,
        },
        form: {
            id,
        },
    });

    let range = 201;
    if (id == 60198) {range = 61;} // Billboard only fetch Top 60

    const data = response.data.playlist;
    const songinfo = await got({
        method: 'get',
        url: `https://music.163.com/api/song/detail?ids=[${data.trackIds.slice(0, range).map((item) => item.id)}]`,
        headers: {
            Referer: 'https://music.163.com',
        },
    });
    const songs = songinfo.data.songs;

    ctx.state.data = {
        title: data.name,
        link: `https://music.163.com/#/playlist?id=${id}`,
        description: `网易云音乐歌单 - ${data.name}`,
        item: data.trackIds.slice(0, range).map((item) => {
            const thissong = songs.find((element) => element.id === item.id);
            let prefix = ''
            if (id == 60198) {
                const order = songs.findIndex((element) => element.id === item.id)+1;
                prefix = `[${order.toString().padStart(2, '0')}] `
            };
            const singer = thissong.artists.length === 1 ? thissong.artists[0].name : thissong.artists.reduce((prev, cur) => (prev.name || prev) + '/' + cur.name);
            return {
                title: `${prefix}${thissong.name} - ${singer}`,
                description: `歌手：${singer}<br>专辑：${thissong.album.name}<br>发行日期：${new Date(thissong.album.publishTime).toLocaleDateString()}<br><img src="${
                    thissong.album.picUrl
                }"><iframe frameborder="no" border="0" marginwidth="0" marginheight="0" width=370 height=86 src="https://simple-notion-widgets.vercel.app/music-player/?server=netease&type=song&id=${item.id}&loop=none"></iframe>`,
                link: `https://music.163.com/#/song?id=${item.id}`,
                pubDate: new Date(item.at),
                author: singer,
            };
        }),
    };
};
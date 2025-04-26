const got = require('@/utils/got');
const config = require('@/config').value;

module.exports = async(ctx) => {
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
    if (id == 60198) { range = 61; } // Billboard only fetch Top 60

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
        title: data.name.replace(/[\(（]更新至.+?[\)）]/g, '').trim(),
        link: `https://music.163.com/#/playlist?id=${id}`,
        description: `网易云音乐歌单 - ${data.name}`,
        itunes_explicit: false,
        itunes_image: response.data.playlist.coverImgUrl,
        itunes_author: data.name,
        item: data.trackIds.slice(0, range).map((item) => {
            const thissong = songs.find((element) => element.id === item.id);
            let prefix = '';
            if (id == 60198) {
                const order = songs.findIndex((element) => element.id === item.id) + 1;
                prefix = `[${order.toString().padStart(2, '0')}] `;
            }
            const singer = thissong.artists.length === 1 ? thissong.artists[0].name : thissong.artists.map((artist) => artist.name).join('/');
            return {
                title: `${prefix}${thissong.name} - ${singer}`,
                description: `<p>歌手：${singer}  </p><p>专辑：${thissong.album.name}  </p>`+
                    `<p>发行日期：${new Date(thissong.album.publishTime).toLocaleDateString()}  </p>`+
                    `<p>链接：<a href=https://music.163.com/#/song?id=${item.id}>https://music.163.com/#/song?id=${item.id}</a>  </p>` +
                    `<br><img src="${thissong.album.picUrl}?param=800y800">`,
                link: `https://music.163.com/#/song?id=${item.id}`,
                pubDate: new Date(item.at),
                author: singer,
                itunes_item_image: thissong.album.picUrl,
                itunes_explicit: false,
                itunes_duration: thissong.duration / 1000,
                enclosure_url: config.hotlink.relay ? `${config.hotlink.relay}/netease/song?id=${item.id}` : null,
                enclosure_type: 'audio/mpeg',
            };
        }),
    };
};
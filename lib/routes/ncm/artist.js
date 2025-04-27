const got = require('@/utils/got');
const config = require('@/config').value;

module.exports = async(ctx) => {
    const id = ctx.params.id;

    const response = await got({
        method: 'get',
        url: `https://music.163.com/api/artist/albums/${id}`,
        headers: {
            Referer: 'https://music.163.com/',
        },
    });

    const data = response.data;
    const photo = data.artist.img1v1Url || data.artist.picUrl;

    ctx.state.data = {
        title: data.artist.name,
        link: `https://music.163.com/#/artist/album?id=${id}`,
        description: `网易云音乐歌手专辑 - ${data.artist.name}`,
        image: photo,
        icon: photo,
        logo: photo,
        item: await Promise.all(
            data.hotAlbums
            .filter((item) => item.subType !== 'Remix')
            .slice(0, 5)
            .map(async(item) => {
                const singer = item.artists.length === 1 ? item.artists[0].name : item.artists.reduce((prev, cur) => (prev.name || prev) + '/' + cur.name);
                const explicit = item.mark ? item.mark == 1056768 : null;
                const search = `${item.name}${explicit ? " (Explicit)":""} - ${singer}`;

                const albumDetail = await got({
                    method: 'get',
                    url: `${config.hotlink.neteaseAPI}/api.php?types=search&source=netease&name=${encodeURIComponent(search)}`
                });

                let single = false;
                if (config.hotlink.neteaseAPI && albumDetail.status == 200 &&albumDetail.data && albumDetail.data.length > 0) {
                    single = item.size == 1 || (item.size < 4 && albumDetail.data.slice(1, item.size).every(track => track.name.replace(albumDetail.data[0].name, '').trim().match(/^\((.*?)\)$/)));
                }

                if (single) {

                    const track = albumDetail.data[0];

                    return {
                        title: `${item.name}${explicit ? " (Explicit)" : ""} - ${singer}`,
                        description: `<p>歌手：${singer}  </p><p>专辑：${item.name}  </p>` +
                            `<p>日期：${new Date(item.publishTime).toLocaleDateString()}  </p>` +
                            `<p>类型：[${item.size}] ${item.type} - ${item.subType}  </p>` +
                            `<p>链接：<a href=https://music.163.com/#/album?id=${item.id}>https://music.163.com/#/album?id=${item.id}</a>  </p>` +
                            `<br><img src="${item.picUrl}?param=800y800">`,
                        link: `https://music.163.com/#/album?id=${item.id}`,
                        pubDate: new Date(item.publishTime),
                        published: new Date(item.publishTime),
                        category: [item.type, item.subType, 'Playable'],
                        author: singer,
                        itunes_item_image: item.picUrl,
                        itunes_explicit: false,
                        enclosure_url: config.hotlink.relay ? `${config.hotlink.relay}/netease/song?id=${track.id}` : null,
                        enclosure_type: 'audio/mpeg',
                    };
                }

                return {
                    title: `[${item.type}${item.subType == '录音室版' ? '' : ' ' + item.subType}] ${item.name}${explicit ? " (Explicit)" : ""} - ${singer}`,
                    description: `<p>歌手：${singer}  </p><p>专辑：${item.name}  </p>` +
                        `<p>日期：${new Date(item.publishTime).toLocaleDateString()}  </p>` +
                        `<p>类型：[${item.size}] ${item.type} - ${item.subType}  </p>` +
                        `<p>链接：<a href=https://music.163.com/#/album?id=${item.id}>https://music.163.com/#/album?id=${item.id}</a>  </p>` +
                        `<br><img src="${item.picUrl}?param=800y800">`,
                    link: `https://music.163.com/#/album?id=${item.id}`,
                    pubDate: new Date(item.publishTime),
                    published: new Date(item.publishTime),
                    category: [item.type, item.subType],
                    author: singer
                };
            })
        ),
    };
};
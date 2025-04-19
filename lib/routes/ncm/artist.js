const got = require('@/utils/got');

module.exports = async (ctx) => {
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
        item: data.hotAlbums.map((item) => {
            const singer = item.artists.length === 1 ? item.artists[0].name : item.artists.reduce((prev, cur) => (prev.name || prev) + '/' + cur.name);
            const explicit = item.mark ? item.mark==1056768 : null; 
            return {
                title: `[${item.type}-${item.subType}] ${item.name}${explicit ? " (Explicit)":""} - ${singer}`,
                description: `歌手：${singer}<br>专辑：${item.name}<br>日期：${new Date(item.publishTime).toLocaleDateString()}`+
                    `<br>类型：${item.type} - ${item.subType}`+
                    `<br><iframe frameborder="no" border="0" marginwidth="0" marginheight="0" width=350 height=430 src="https://music.163.com/outchain/player?type=1&auto=0&height=430&id=${item.id}"></iframe>`+
                    `<br><img src="${item.picUrl}?param=800y800">`,
                link: `https://music.163.com/#/album?id=${item.id}`,
                pubDate: new Date(item.publishTime),
                published: new Date(item.publishTime),
                category: item.subType,
                author: singer,
            };
        }),
    };
};
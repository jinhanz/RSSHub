const got = require('@/utils/got');
const cheerio = require('cheerio');

module.exports = async (ctx) => {
    const id = ctx.params.id;

    // const response = await got({
    //     method: 'get',
    //     url: `https://y.qq.com/n/ryqq/singer/${id}/album`,
    //     headers: {
    //         Referer: 'https://y.qq.com/',
    //     },
    // });

    const response = await got.get(`https://y.qq.com/n/ryqq/singer/${id}/album`);
    const $ = cheerio.load(response.data);

    const artist_name = $('#app > div > div.main > div.mod_data > div.data__cont > div.data__name > h1').text();

    // TODO: get album details (handle multiple artist)
    const list = $('#app > div > div.main > div.mod_part > ul > li')
        .map((_, item) => {
            const title = $(item).find('h4 > span').text();
            const link = 'https://y.qq.com' + $(item).find('div.playlist__cover.mod_cover > a').attr('href');
            const date = $(item).find('div.playlist__other').text();
            // FIXME: img lazy loading
            // const picUrl = $(item).find('div.playlist__cover.mod_cover').find('img').attr('src');
            const id = link.split('/').pop();

            return {
                title,
                link,
                date,
                // picUrl,
                id
            };
        })
        .get();

    // TODO: fix putdate to reflect chinese locale
    ctx.state.data = {
        title: String(artist_name),
        link: `https://y.qq.com/n/ryqq/singer/${id}/album`,
        description: `QQ音乐歌手专辑 - ${artist_name}`,
        item: list.map((item) => ({
                title: `${item.title} - ${artist_name}`,
                description: `歌手：${artist_name}<br>专辑：${item.title}<br>日期：${new Date(item.date).toLocaleDateString()}<br><br>
                <iframe frameborder="no" border="0" marginwidth="0" marginheight="0" width=350 height=430 src="https://notion.busiyi.world/music-player/?server=tencent&type=album&id=${item.id}"></iframe>`,
                link: String(item.link),
                pubDate: new Date(item.date),
                published: new Date(item.date),
                author: artist_name,
            })),
    };
};

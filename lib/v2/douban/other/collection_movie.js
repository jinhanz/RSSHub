const got = require('@/utils/got');

module.exports = async (ctx) => {
    const type = ctx.params.type;

    const link = `https://m.douban.com/movie`;
    const apiUrl = `https://m.douban.com/rexxar/api/v2/subject_collection/${type}`;

    const itemResponse = await got({
        method: 'get',
        url: `${apiUrl}/items?start=0&count=10`,
        headers: {
            Referer: link,
        },
    });
    const infoResponse = await got({
        method: 'get',
        url: apiUrl,
        headers: {
            Referer: link,
        },
    });

    const data = itemResponse.data.subject_collection_items;

    ctx.state.data = {
        title: infoResponse.data.title,
        link: `https://m.douban.com/subject_collection/${type}`,
        description: infoResponse.data.description,

        item: await Promise.all(
            data.map(async ({ id, title, info, cover, url, rating, year, release_date, null_rating_reason, description }) => {
                const release = `${year}.${release_date}`;
                const rate = rating ? `${rating.value.toFixed(1)}分   (${rating.count.toLocaleString('en-US')}人)` : null_rating_reason;

                const itemInfo = await got({
                    method: 'get',
                    url: `https://m.douban.com/rexxar/api/v2/movie/${id}`,
                    headers: {
                        Referer: link,
                    },
                });

                const intro = itemInfo.data.intro;
                const parsed_intro = intro.replace(/\r?\n/g, '<br>');
                if (!itemInfo.data.trailer) {
                    description = `<img src="${cover.url}"><br>${rate} <br>${info} <br>${release} <br> <p>${parsed_intro}</p><br><br>`;
                } else {
                    description = `<img src="${cover.url}"><br>${rate} <br>${info} <br>${release} <br> <p>${parsed_intro}</p><video width="350" height="240" controls="controls" poster="${itemInfo.data.trailer.cover_url}"><source src="${itemInfo.data.trailer.video_url}?autoplay=0"></video><br><br>`;
                }

                return {
                    title,
                    description,
                    link: url,
                };
            })
        ),
    };
};
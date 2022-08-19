const got = require('@/utils/got');
const { stringify } = require('query-string');

module.exports = async(ctx) => {
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

        item: await Promise.all(data.map(async({ id, title, info, cover, url, rating, year, release_date, null_rating_reason, description }) => {
            const release = `${year}.${release_date}`;
            const rate = rating ? `${rating.value.toFixed(1)}分   (${rating.count}人)` : null_rating_reason;

            const itemInfo = await got({
                method: 'get',
                url: `https://m.douban.com/rexxar/api/v2/book/${id}`,
                headers: {
                    Referer: link,
                },
            });

            intro = itemInfo.data.intro;
            parsed_intro = intro.replace(/\r?\n/g, "<br>");

            description = `<img src="${cover.url}"><br>${info} <br>${release} <br>${rate} <br><p>${parsed_intro}</p>`;

            return {
                title,
                description,
                link: url,
            };
        })),
    };
};
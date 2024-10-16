const got = require('@/utils/got');

module.exports = async (ctx) => {
    const type = ctx.params.type;

    const link = `https://m.douban.com/movie`;
    const apiUrl = `https://m.douban.com/rexxar/api/v2/subject_collection/${type}`;

    const detailed = type != 'movie_top250';
    const limit = detailed ? '?start=0&count=10' : '?start=0&count=250';

    const itemResponse = await got({
        method: 'get',
        url: `${apiUrl}/items${limit}`,
        headers: {
            Referer: link,
        },
    });

    const data = itemResponse.data.subject_collection_items;

    ctx.state.data = {
        title: itemResponse.data.subject_collection.title,
        link: `https://m.douban.com/subject_collection/${type}`,
        description: itemResponse.data.subject_collection.description,

        item: await Promise.all(
            data.map(async({ id, title, info, card_subtitle, cover, cover_url, url, rating, year, release_date, null_rating_reason, description }) => {
                const release = year ? `${year}.${release_date}` : '';
                const rate = rating ? `${rating.value.toFixed(1)}分   (${rating.count.toLocaleString('en-US')}人)` : null_rating_reason;
                if (cover && cover.url) {
                    cover_url = cover.url;
                }
                if (!info) {
                    info = card_subtitle;
                }

                if (detailed) {
                    const itemInfo = await got({
                        method: 'get',
                        url: `https://m.douban.com/rexxar/api/v2/movie/${id}`,
                        headers: {
                            Referer: link,
                        },
                    });

                    const intro = itemInfo.data.intro;
                    const parsed_intro = intro.replace(/\r?\n/g, '<br>');
                    description = `<img src="${cover_url}"><br>${rate} <br>${release} <br>${info} <br> <p>${parsed_intro}</p>`;
                    if (itemInfo.data.trailers.length>0) {
                        itemInfo.data.trailers.forEach(trailer => {
                            description += `<p>${trailer.title}:</p><video width="350" height="240" controls="controls" preload="none" poster="${trailer.cover_url}">
                                                <source src="${trailer.video_url}?autoplay=0">
                                            </video>`;
                        });
                    }
                    description += `<br><br>`
                } else {
                    description = `<img src="${cover_url}"><br>${rate} <br>${release} <br>${info}<br><br>`;
                }

                return {
                    title,
                    description,
                    link: `https://movie.douban.com/subject/${id}`,
                };
            })
        ),
    };
};
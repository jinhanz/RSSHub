const querystring = require('querystring');
const cheerio = require('cheerio');
const got = require('@/utils/got');
const config = require('@/config').value;
module.exports = async (ctx) => {
    const userid = ctx.params.userid;
    const routeParams = querystring.parse(ctx.params.routeParams);

    // Add year to title for more accurate searching
    const yearInTitle = routeParams.yearInTitle === 'true' || routeParams.yearInTitle === '1';

    // enable torrent search
    const providers = routeParams.torrentProvider === 'all' ? torrent.allProviders : routeParams.torrentProvider ? routeParams.torrentProvider.split(',') : [];
    const torrentMinSeeds = routeParams.torrentMinSeeds ? parseInt(routeParams.torrentMinSeeds) : 1;
    const torrentMinRating = routeParams.torrentMinRating ? parseFloat(routeParams.torrentMinRating) : 0.5;
    const torrentSkipNoMatch = routeParams.torrentSkipNoMatch === 'true';

    let userName;

    const pageSize = 15;
    const pagesCount = routeParams.pagesCount ? Number.parseInt(routeParams.pagesCount) : 1;
    const tasks = [];
    for (let page = 0; page < pagesCount; page += 1) {
        const url = `https://movie.douban.com/people/${userid}/wish?start=${page * pageSize}`;

        tasks.push(
            ctx.cache
                .tryGet(
                    url,
                    async () => {
                        const _r = await got({
                            method: 'GET',
                            url,
                            headers: {
                                Referer: url,
                                Cookie: config.douban.cookie || '',
                            },
                        });
                        return _r.data;
                    },
                    config.cache.routeExpire,
                    false
                )
                .then((data) => {
                    const $ = cheerio.load(data);
                    const list = $('div.article > div.grid-view > div.item');
                    userName = userName || $('div.side-info-txt > h3').text();

                    if (list) {
                        return Promise.all(
                            list.get().map((item) => {
                                item = $(item);
                                const itemPicUrl = item.find('.pic a img').attr('src');
                                const info = item.find('.info');
                                const title = info.find('ul li.title a').text();
                                const url = info.find('ul li.title a').attr('href');
                                const foundYear = info.find('.intro').text().match(/[0-9]{4}/);
                                if (foundYear) {
                                    year = foundYear[0];
                                }

                                // TODO: use separate API to distinguish TV/Movies and get imdbid
                                const titles = title.split('/').filter((title) => title.trim());
                                if (yearInTitle && foundYear) {
                                    displayTitle = (titles[0] + '(' + year + ')').trim();
                                }
                                else { displayTitle = titles[0].trim();}

                                const day = info.find('ul li .date').text().trim();
                                const rssItem = {
                                    title: displayTitle,
                                    description: `${info.find('.intro').text()}<br><img src="${itemPicUrl}">`,
                                    link: url,
                                    pubDate: new Date(day),
                                };

                                return rssItem;
                            })
                        );
                    }
                })
        );
    }

    const items = (await Promise.all(tasks)).flat();
    ctx.state.data = {
        title: `豆瓣想看 - ${userName || userid}`,
        link: `https://movie.douban.com/people/${userid}/wish`,
        item: items,
    };
};

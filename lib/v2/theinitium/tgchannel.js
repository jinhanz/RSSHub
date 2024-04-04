const got = require('@/utils/got');
const cheerio = require('cheerio');

module.exports = async (ctx) => {
    const id = 'theinitium_rss';

    const channelUrl = `https://t.me/s/${id}`;
    const { data } = await got.get(channelUrl);
    const $ = cheerio.load(data);
    const list = $('.tgme_widget_message_wrap .tgme_widget_message_link_preview ')
                    .slice(-20);

    // list.reverse();
    ctx.state.data = {
        title: '端传媒 Latest',
        link: `https://t.me/s/${id}`,
        icon: 'https://theinitium.com/misc/about/logo192.png',
        logo: 'https://theinitium.com/misc/about/logo192.png',
        item: await Promise.all(
            list
                .map(async (idx, item) => {
                    item = $(item) 
                    return {
                        title: item.find('.link_preview_title').text().replace('- 端传媒 - 最新','').trim(),
                        description : item.find('.link_preview_description').text() + '<br>' +
                                        `<img src=${item.find('.link_preview_right_image').attr('style').replace('background-image:url(','').replace(')','')}>`,
                        link: item.attr('href')
                    }
                }))
    };
};

const got = require('@/utils/got');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const { art } = require('@/utils/render');
const path = require('path');

const rootUrl = 'https://www.baozimh.com';

module.exports = async(ctx) => {
    const name = ctx.params.name;
    const url = `${rootUrl}/comic/${name}`;

    const response = await got.get(url);
    const $ = cheerio.load(response.data);
    const comicTitle = $('div > div.pure-u-1-1.pure-u-sm-2-3.pure-u-md-3-4 > div > h1').text();
    const list = $('#layout > div.comics-detail > div:nth-child(3) > div > div:nth-child(2) > div')
        .map((_, item) => {
            const title = $(item).find('span').text();
            const link = rootUrl + $(item).find('a').attr('href');

            return {
                title,
                link,
            };
        })
        .slice(0,2)
        .get();

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async() => {
                const directUrlParams = new URLSearchParams(new URL(item.link).search);
                const comicId = directUrlParams.get('comic_id');
                const sectionSolt = directUrlParams.get('section_slot');
                const chapterSlot = directUrlParams.get('chapter_slot');
                const descUrl = `https://www.webmota.com/comic/chapter/${comicId}/${sectionSolt}_${chapterSlot}.html`;

                // TODO: optimzie code and remove node-fetch
                // From:https://github.com/HaleyLeoZhang/node_puppeteer_framework/blob/master/es6/services/Comic/BaoZiService.js
                let image_list = [];
                const image_map = {}; // 去重，这个渠道，图片翻页可能出现重复的

                let has_more = true;
                for (let i = 1; has_more; i++) {
                    const link = descUrl.replace(".html", `_${i}.html`);

                    // list one

                    const options = {
                        'headers': {
                            'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E; QQBrowser/7.0.3698.400)',
                        },
                    };

                    const image_list_one_page = await fetch(link, options)
                        .then((res) => res.text())
                        .then((html) => {
                            const image_list_temp = [];
                            const $1 = cheerio.load(html);
                            const image_object_list = $1(".comic-contain__item");
                            const image_length = image_object_list.length;
                            for (let i = 0; i < image_length; i++) {
                                const src = image_object_list.eq(i).attr("src");
                                image_list_temp.push(src);
                            }
                            return image_list_temp;
                        });

                    const len_one_page = image_list_one_page.length;
                    const len_img = image_list.length;
                    if (len_one_page === 0) {
                        has_more = false;
                        continue;
                    } else if (len_img > 0 && (image_list_one_page[len_one_page - 1] === image_list[len_img - 1])) {
                        // 如果最后一张图一样，说明已经到最后一页了
                        has_more = false;
                        continue;
                    }
                    // 处理翻页重复图片问题
                    const image_list_raw = [];
                    for (let j = 0; j < image_list_one_page.length; j++) {
                        const img_key = image_list_one_page[j];
                        if (image_map[img_key] === 1) {
                            // console.log("重复图，跳过")
                            continue;
                        }
                        image_map[img_key] = 1;
                        image_list_raw.push(img_key);
                    }

                    // 合并内容
                    image_list = image_list.concat(image_list_raw);
                }

                item.description = art(path.join(__dirname, 'templates/desc.art'), {
                    imgUrlList: image_list
                });

                return item;
            })
        )
    );

    ctx.state.data = {
        title: `包子漫画-${comicTitle}`,
        link: url,
        item: items,
    };
};
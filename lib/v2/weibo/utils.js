const querystring = require('querystring');
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { fallback, queryToBoolean, queryToInteger } = require('@/utils/readable-social');

const weiboUtils = {
    formatTitle: (html) =>
        html
            .replace(/<a\s+href="https:\/\/video\.weibo\.com\/show\?fid=\d+:\d+".*?>.*?的微博视频<\/a>/,'') // xxx的微博视频
        .replace(/<span class=["']url-icon["']><img\s[^>]*?alt=["']?([^>]+?)["']?\s[^>]*?\/?><\/span>/g, '') // 表情转换
        .replace(/<span class=["']url-icon["']>(<img\s[^>]*>)<\/span>/g, '') // 去掉所有图标
        .replace(/<img\s[^<]*>/g, '')
        // impossible to have inline script in weibo posts, but CodeQL complains about it
        // Dismiss it through the UI: https://github.com/github/codeql/issues/11427
        .replaceAll(/<[^<]*>/g, '')
        .replaceAll('\n', ' ')
        .trim(),
    formatExtended: (ctx, status, uid = undefined, params = {}, picsPrefixes = [], isRetweet = false) => {
        // `uid = undefined` to explicitly mark it as optional, avoiding IDEs prompting warnings

        // undefined and strings like "1" is also safely parsed, so no if branch is needed
        const routeParams = querystring.parse(ctx.params.routeParams);

        const mergedParams = {
            readable: fallback(params.readable, queryToBoolean(routeParams.readable), true),
            authorNameBold: fallback(params.authorNameBold, queryToBoolean(routeParams.authorNameBold), false),
            showAuthorInTitle: fallback(params.showAuthorInTitle, queryToBoolean(routeParams.showAuthorInTitle), false),
            showAuthorInDesc: fallback(params.showAuthorInDesc, queryToBoolean(routeParams.showAuthorInDesc), true),
            showAuthorAvatarInDesc: fallback(params.showAuthorAvatarInDesc, queryToBoolean(routeParams.showAuthorAvatarInDesc), true),
            showAtBeforeAuthor: fallback(params.showAtBeforeAuthor, null, false),
            showEmojiForRetweet: fallback(params.showEmojiForRetweet, queryToBoolean(routeParams.showEmojiForRetweet), false),
            showRetweetTextInTitle: fallback(params.showRetweetTextInTitle, queryToBoolean(routeParams.showRetweetTextInTitle), true),
            addLinkForPics: fallback(params.addLinkForPics, queryToBoolean(routeParams.addLinkForPics), false),
            showTimestampInDescription: fallback(params.showTimestampInDescription, queryToBoolean(routeParams.showTimestampInDescription), true),

            widthOfPics: fallback(params.widthOfPics, queryToInteger(routeParams.widthOfPics), -1),
            heightOfPics: fallback(params.heightOfPics, queryToInteger(routeParams.heightOfPics), -1),
            sizeOfAuthorAvatar: fallback(params.sizeOfAuthorAvatar, queryToInteger(routeParams.sizeOfAuthorAvatar), 18),
            showEmojiInDescription: fallback(params.showEmojiInDescription, queryToInteger(routeParams.showEmojiInDescription), true),
            showLinkIconInDescription: fallback(params.showLinkIconInDescription, queryToInteger(routeParams.showLinkIconInDescription), false),
            preferMobileLink: fallback(params.preferMobileLink, queryToBoolean(routeParams.preferMobileLink), false),

            addPicsPrefixes: fallback(params.addPicsPrefixes, queryToBoolean(routeParams.addPicsPrefixes), false),
        };

        params = mergedParams;

        const {
            readable,
            authorNameBold,
            showAuthorInTitle,
            showAuthorInDesc,
            showAuthorAvatarInDesc,
            showAtBeforeAuthor,
            showEmojiForRetweet,
            showRetweetTextInTitle,
            addLinkForPics,
            showTimestampInDescription,

            widthOfPics,
            heightOfPics,
            sizeOfAuthorAvatar,
            showEmojiInDescription,
            showLinkIconInDescription,
            preferMobileLink,

            addPicsPrefixes
        } = params;

        if (!addPicsPrefixes) {
            picsPrefixes = [];
        }

        let retweeted = '';
        // 长文章的处理
        let htmlNewLineUnreplaced = (status.longText && status.longText.longTextContent) || status.text || '';
        // 表情图标转换为文字
        if (!showEmojiInDescription) {
            htmlNewLineUnreplaced = htmlNewLineUnreplaced.replaceAll(/<span class=["']?url-icon["']?><img\s[^>]*?alt=["']?([^>]+?)["']?\s[^>]*?\/><\/span>/g, '$1');
        }
        // 去掉链接的图标，保留 a 标签链接
        if (!showLinkIconInDescription) {
            htmlNewLineUnreplaced = htmlNewLineUnreplaced.replaceAll(/(<a\s[^>]*>)<span class=["']?url-icon["']?><img\s[^>]*><\/span>[^<>]*?<span class=["']?surl-text["']?>([^<>]*?)<\/span><\/a>/g, '$1$2</a>');
        }
        // 去掉乱七八糟的图标  // 不需要，上述的替换应该已经把所有的图标都替换掉了，且这条 regex 会破坏上述替换不发生时的输出
        // htmlNewLineUnreplaced = htmlNewLineUnreplaced.replace(/<span class=["']?url-icon["']?>(<img\s[^>]*?>)<\/span>/g, '');
        // 将行内图标的高度设置为一行，改善阅读体验。但有些阅读器删除了 style 属性，无法生效  // 不需要，微博已经作此设置
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replace(/(?<=<span class=["']?url-icon["']?>)<img/g, '<img style="margin-top:3" width="20px"');
        // 去掉全文
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replaceAll('全文<br>', '<br>');
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replaceAll(/<a href="(.*?)">全文<\/a>/g, '');

        // 处理外部链接
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replaceAll(/"https:\/\/weibo\.cn\/sinaurl.*?[&?]u=(http.*?)"/g, (match, p1) => `"${decodeURIComponent(p1)}"`);

        // 处理图片的链接
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replaceAll(/<a\s+href="https?:\/\/.+\.(jpg|png|gif)"/g, (match) => `${match} data-rsshub-image="href"`);

        let html = htmlNewLineUnreplaced.replaceAll('\n', '<br>');

        // TODO: avatar support for retweeter
        // 添加用户名和头像 original poster only
        // TODO: messy when retweeted multiple times on one thread
        // Note: display:inline-block considered invalid syntax for rss/inoreader
        if (showAuthorInDesc && isRetweet) {
            let usernameAndAvatar = `<p>`;
            if (showAuthorAvatarInDesc) {
                usernameAndAvatar += `<img style="margin-top: 3;border-radius: 5;" width="${sizeOfAuthorAvatar}" height="${sizeOfAuthorAvatar}" src="${status.user.profile_image_url}" ${readable ? 'hspace="8" vspace="0" align="left"' : ''} /> `;
            }
            let name = status.user.screen_name;
            usernameAndAvatar += `转发 `;
            if (showAtBeforeAuthor) {
                name = '@' + name;
            }
            if (authorNameBold) {
                usernameAndAvatar += `<strong>${name}</strong>`;
            } else {
                usernameAndAvatar += String(name);
            }
            usernameAndAvatar += `：<br>`;
            if (showTimestampInDescription) {
                usernameAndAvatar += `<small>` + new Date(status.created_at).toLocaleString() + `</small>`;
            }
            if (readable) {
                usernameAndAvatar += ` <small><a href="https://weibo.com/${status.user.id}/${status.bid}" target="_blank" rel="noopener noreferrer">原博</a></small>`;
            }
            usernameAndAvatar += `</p>`;
            html = usernameAndAvatar + html;
        }

        // status.pics can be either an array or an object:
        // array: [ object, object, ... ]
        // object: { '0': object, '1': object, ... }  // REALLY AMAZING data structure
        if (status.pics && !Array.isArray(status.pics) && typeof status.pics === 'object') {
            status.pics = Object.values(status.pics);
        }

        // 添加文章头图，此处不需要回落到被转发的微博，后续处理被转发的微博时，还会执行到这里
        if (status.page_info && status.page_info.type === 'article' && status.page_info.page_pic && status.page_info.page_pic.url) {
            // 如果以后后续流程会用到其他字段，记得修改这里
            const pagePic = {
                large: {
                    url: status.page_info.page_pic.url,
                },
            };
            // 文章微博一般不会有配图，但也有可能有：https://weibo.com/6882481489/Lh85BkS3m
            if (status.pics) {
                status.pics.push(pagePic);
            } else {
                status.pics = [pagePic];
            }
        }

        // drop live photo
        const livePhotoCount = status.pics ? status.pics.filter((pic) => pic.type === 'livephotos').length : 0;
        const pics = status.pics && status.pics.filter((pic) => pic.type !== 'livephotos');

        // 添加微博配图
        if (pics && pics.length>0) {
            if (readable) {
                html += '<br clear="both" /><div style="clear: both"></div>';
            }

            // 一些RSS Reader会识别所有<img>标签作为内含图片显示，我们不想要头像也作为内含图片之一
            // 让所有配图在description的最前面再次出现一次，但宽高设为0 
            // Shaderein: only appear once as Reeder doesn't respect invisibility
            // let picsPrefix = '';
            // picsPrefix += `<img style="display:none;" width="0" height="0" hidden="true" src="${pics[0].large.url.replace('/large/','/mw2000/')}">`;

            // picsPrefixes.push(picsPrefix);

            for (const item of pics) {
                if (addLinkForPics) {
                    html += '<a href="' + item.large.url.replace('/large/','/mw2000/') + '">';
                }

                let style = '';
                html += '<img ';
                html += readable ? 'vspace="8" hspace="4"' : '';
                if (widthOfPics >= 0) {
                    html += ` width="${widthOfPics}"`;
                    style += `width: ${widthOfPics}px;`;
                }
                if (heightOfPics >= 0) {
                    html += ` height="${heightOfPics}"`;
                    style += `height: ${heightOfPics}px;`;
                }
                html += ` style="${style}"` + ' src="' + item.large.url.replace('/large/','/mw2000/') + '">';

                if (addLinkForPics) {
                    html += '</a>';
                }

                if (!readable) {
                    html += '<br><br>';
                }

                htmlNewLineUnreplaced += '<img src="" />';
            }
        }

        // Enclose images (Inoreader display issue when full-width image enabled)
        html = '<div>' + html + '</div>';

        // 处理转发的微博
        if (status.retweeted_status) {
            if (readable) {
                html += `<div style="clear: both"></div><br><div style="border-top: 3px solid gray;">`;
            } else {
                html += `<div> - 转发 `;
            }
            if (!status.retweeted_status.user) {
                // 当转发的微博被删除时user为null
                status.retweeted_status.user = {
                    profile_image_url: '',
                    screen_name: '[原微博不可访问]',
                    id: 'sorry',
                };
            }
            // 插入转发的微博
            const retweetedParams = Object.assign({}, params);
            retweetedParams.showAuthorInDesc = true;
            retweetedParams.showAuthorAvatarInDesc = showAuthorAvatarInDesc; // Note: emphasize original posts
            retweetedParams.showAtBeforeAuthor = true;
            retweeted += weiboUtils.formatExtended(ctx, status.retweeted_status, undefined, retweetedParams, picsPrefixes, (isRetweet = true)).description; // TODO: retweet in tuple?

            html += retweeted;

            if (readable) {
                html += `<br clear="both" /><div style="clear: both"></div>`;
            }

            html += '</div>';
        }

        if (showAuthorInDesc && showAuthorAvatarInDesc) {
            html = picsPrefixes.join('') + html;
        }

        let title = '';
        if (showAuthorInTitle) {
            title += status.user.screen_name + ': ';
        }
        if (!status.retweeted_status || showRetweetTextInTitle) {
            title += weiboUtils.formatTitle(htmlNewLineUnreplaced);
        }

        // Trim title
        // 去除话题（做数据用模板）
        if (status.user.id === 7388686848) { // 备忘录
            title = title
                .replace(/(#.+?#|刘雨昕).*?#.+?#/, '') // #刘雨昕#🌧️#刘雨昕这就是街舞5#
                .replace(/@刘雨昕/, '')
                .replace(/(【饭拍图片】|【饭拍视频】)/, '饭拍 ')
                .replace(/(【图片】|【视频】)/, '')
                .replace(/(【.+?更新】)/, '')
                .replace('【', '').replace('】', ' ')
                .replace(/- 刘雨昕_无限昕动备忘录的微博视频/g,'')
                .trim(); // 数据格式

            html = html
                .replace(/(#.+?#|刘雨昕).*?#.+?#/, '') // #刘雨昕#🌧️#刘雨昕这就是街舞5#
                .replace(/@刘雨昕/, '');
        } else if (status.user.id === 6303297939) { // 工作室
            title = title.replace(/@刘雨昕/, '')
                .replace(/#(刘雨昕打卡吧吃货团|刘雨昕这就是街舞5|这就是街舞|打卡吧吃货团)#/, '');
            special_hashtag = title.match(/^#.*?#/);
            if (special_hashtag) {
                title = special_hashtag[0];
                html = html.replace(special_hashtag, '');
            }
        } else if (status.user.id === 5636577946) { // 此沙工作室
            title = title
                .replace(/(#.+?#|此沙)·#.+?#/, '') // 此沙·#...#
                .replace(/\s?@此沙是个小演员\s?/, '')
                .trim(); // 数据格式
        }
        // else if (status.user.id in [5873553397, 3261134763, 2956384255]) { //明星

        // }

        title = title.replace(/#.*?#/g, '') // 任何话题


        // Consider only the first few lines for title
        if (!showEmojiInDescription) {
            title = title.replace(/\[.+?\]/g,'')
        }
        const title_orig = title;
        title = '';
        let boundary = /[ !！"“#$%&'(（)）*+,，\-.。/：:；;《》<=>？?@【】[\\\]^_{|}~]/;
        for (let char of title_orig) {
            if ((title + char).length > 33 && boundary.test(char)) {
                break;
            }
            title += char;
        }

        if (status.retweeted_status && showEmojiForRetweet) {
            title = '🔁 ' + title;
        }

        let picsCount = 0;
        if (status.retweeted_status && status.retweeted_status.pics) {
            picsCount += status.retweeted_status.pics.length;
        }
        if (status.pics) { picsCount += status.pics.length; }
        if (picsCount > 1) {
            title = picsCount + '🔲 ' + title;
        } else if (picsCount = 1) {
            title = title;
        }


        if ((status.page_info && status.page_info.type === 'video') || (status.retweeted_status && status.retweeted_status.page_info && status.retweeted_status.page_info.type === 'video')) {
            title = '🎞 ' + title;
        }

        // Cleanup redundant spaces between emojis
        title = title.replace('🔲 🔁', '🔲🔁').replace('🎞 🔁', '🎞🔁');

        html = html.replace(/(<a\s+href="https:\/\/video\.weibo\.com\/show\?fid=\d+:\d+".*?>.*?的微博视频<\/a>)/, `<br>$1`)

        uid = uid || status.user?.id;
        const bid = status.bid || status.id;
        const guid = uid ? `https://weibo.com/${uid}/${bid}` : `https://m.weibo.cn/status/${bid}`;
        const link = preferMobileLink ? `https://m.weibo.cn/status/${bid}` : guid;

        const author = status.user?.screen_name;
        const pubDate = status.created_at;

        return { description: html, title, link, guid, author, pubDate };
    },
    getShowData: async (uid, bid) => {
        const link = `https://m.weibo.cn/statuses/show?id=${bid}`;
        const itemResponse = await got.get(link, {
            headers: {
                Referer: `https://m.weibo.cn/u/${uid}`,
                'MWeibo-Pwa': 1,
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
            },
        });
        return itemResponse.data.data;
    },
    formatVideo: (itemDesc, status) => {
        const pageInfo = status.page_info;
        const livePhotos = status.pics && status.pics.filter((pic) => pic.type === 'livephotos' && pic.videoSrc);
        let video = '<br clear="both" /><div style="clear: both"></div>';
        let anyVideo = false;

        // Note: add invisible pics for video posters
        let picsPrefix = '';
        if (livePhotos) {
            for (const livePhoto of livePhotos) {
                video += `<video controls="controls" poster="${(livePhoto.large && livePhoto.large.url) || livePhoto.url}" src="${livePhoto.videoSrc}" style="width: 100%"></video>`;
                // picsPrefix += `<img width="0" height="0" hidden="true" src="${(livePhoto.large && livePhoto.large.url) || livePhoto.url}">`;
                anyVideo = true;
            }
        }
        if (pageInfo && pageInfo.type === 'video') {
            const pagePic = pageInfo.page_pic;
            const posterUrl = pagePic ? pagePic.url : '';
            const pageUrl = pageInfo.page_url; // video page url
            const mediaInfo = pageInfo.media_info || {}; // stream_url, stream_url_hd; deprecated: mp4_720p_mp4, mp4_hd_url, mp4_sd_url
            const urls = pageInfo.urls || {}; // mp4_720p_mp4, mp4_hd_mp4, hevc_mp4_hd, mp4_ld_mp4

            const video720p = urls.mp4_720p_mp4 || mediaInfo.mp4_720p_mp4 || '';
            const videoHd = urls.mp4_hd_mp4 || mediaInfo.mp4_hd_url || mediaInfo.stream_url_hd || '';
            const videoHdHevc = urls.hevc_mp4_hd || '';
            const videoLd = urls.mp4_ld_mp4 || mediaInfo.mp4_sd_url || mediaInfo.stream_url || '';

            videoHighest = null;
            // TODO:
            // show_link = `https://tenapi.cn/wbsp/?url=${pageUrl}`
            // const response = await got.get(show_link,).data;
            // // In case API down
            // if (response.code == 200) {
            //     videoHighest = `https:${response.url}`
            // }

            const hasVideo = videoHighest || video720p || videoHd || videoHdHevc || videoLd;

            if (hasVideo) {
                video += `<video controls="controls" poster="${posterUrl}" style="width: 100%">`;
                if (videoHighest) {
                    video += `<source src="${videoHighest}">`;
                }
                if (video720p) {
                    video += `<source src="${video720p}">`;
                }
                if (videoHd) {
                    video += `<source src="${videoHd}">`;
                }
                if (videoHdHevc) {
                    video += `<source src="${videoHdHevc}">`;
                }
                if (videoLd) {
                    video += `<source src="${videoLd}">`;
                }
                if (pageUrl) {
                    video += `<p>视频无法显示，请前往<a href="${pageUrl}" target="_blank" rel="noopener noreferrer">微博视频</a>观看。</p>`;
                }
                video += `</video>`;
                // picsPrefix += `<img width="0" height="0" hidden="true" src="${posterUrl}">`;
                anyVideo = true;
            }
        }
        if (anyVideo) {
            itemDesc += video;
            itemDesc = picsPrefix + itemDesc;
        }
        return itemDesc;
    },
    formatArticle: async (ctx, itemDesc, status) => {
        const pageInfo = status.page_info;
        if (pageInfo && pageInfo.type === 'article' && pageInfo.page_url) {
            const pageUrl = pageInfo.page_url;
            const articleIdMatch = pageUrl.match(/id=(\d+)/);
            if (!articleIdMatch) {
                return itemDesc;
            }
            const articleId = articleIdMatch[1];
            const link = `https://card.weibo.com/article/m/aj/detail?id=${articleId}`;
            const response = await ctx.cache.tryGet(link, async () => {
                const _response = await got.get(link, {
                    headers: {
                        Referer: `https://card.weibo.com/article/m/show/id/${articleId}`,
                        'MWeibo-Pwa': 1,
                        'X-Requested-With': 'XMLHttpRequest',
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
                    },
                });
                return _response.data;
            }); // cache it!
            const article = response.data;
            if (article && article.title && article.content) {
                const title = article.title;
                const content = article.content;
                const summary = article.summary;
                const createAt = article.create_at;
                const readCount = article.read_count;
                const isOriginal = article.is_original;
                const isArticleNonFree = article.is_article_free; // 微博起错了字段名，它为 1 时才是收费文章

                // 许多微博文章都给文字设置了白色背景，这里也只好使用白色背景了
                let html = '<br clear="both" /><br clear="both" />';
                html += '<div style="clear: both"></div><div style="background: #fff;border:5px solid #80808030;margin:0;padding:3% 5%;overflow-wrap: break-word">';

                html += `<h1 style="font-size: 1.5rem;line-height: 1.25;color: #333;">${title}</h1>`; // 加入标题

                // 加入文章信息
                const iconStyle =
                    'display: inline-block;margin-inline: 0.25rem;width: 2.25rem; height: 1.125rem; background: #eee; border-radius: 2px; box-sizing: border-box; text-align: center; line-height: 1.0625rem; font-size: 0.75rem; color: #aaa;';
                let articleMeta = '<p style="line-height: 1.66; color: #999;margin: 0 0 0.75rem;font-size: 0.75rem;padding: 0">';
                if (isArticleNonFree) {
                    articleMeta += `<span style="${iconStyle}">试读</span> `;
                }
                if (isOriginal) {
                    articleMeta += `<span style="${iconStyle}">原创</span> `;
                }
                articleMeta += `<span style="margin-inline: 0.25rem;">发布时间: ${createAt}</span> `; // 发布时间
                articleMeta += `<span style="margin-inline: 0.25rem;">阅读量: ${readCount}</span> `; // 阅读量
                articleMeta += '</p>';
                html += articleMeta;

                if (summary) {
                    html += `<p style="color: #999;line-height: 1.5rem;padding: 0.0625rem 0 0.875rem;margin: 0">${summary}</p>`; // 摘要
                }

                html += '<div style="height: 0;border-bottom: 1px dashed #999;margin-bottom: 0.75rem;"></div>'; // 分割线

                // 正文处理，加入一些在微博文章页的 CSS 中定义的不可或缺的样式
                const $ = cheerio.load(content);
                $('p').each((_, elem) => {
                    elem = $(elem);
                    let style = elem.attr('style') || '';
                    style = 'margin: 0;padding: 0;border: 0;' + style;
                    elem.attr('style', style);
                });
                $('.image').each((_, elem) => {
                    elem = $(elem);
                    let style = elem.attr('style') || '';
                    style = 'display: table;text-align: center;margin-left: auto;margin-right: auto;clear: both;min-width: 50px;' + style;
                    elem.attr('style', style);
                });
                $('img').each((_, elem) => {
                    elem = $(elem);
                    let style = elem.attr('style') || '';
                    style = 'display: block;max-width: 100%;margin-left: auto;margin-right: auto;min-width: 50px;' + style;
                    elem.attr('style', style);
                });
                const contentHtml = $.html();
                html += `<div style="line-height: 1.59;text-align: justify;font-size: 1.0625rem;color: #333;">${contentHtml}</div>`; // 正文

                html += '</div>';
                itemDesc += html;
            }
        }
        return itemDesc;
    },
    formatComments: async (ctx, itemDesc, status) => {
        if (status && status.comments_count && status.id && status.mid) {
            const id = status.id;
            const mid = status.mid;
            const link = `https://m.weibo.cn/comments/hotflow?id=${id}&mid=${mid}&max_id_type=0`;
            const response = await ctx.cache.tryGet(link, async () => {
                const _response = await got.get(link, {
                    headers: {
                        Referer: `https://m.weibo.cn/detail/${id}`,
                        'MWeibo-Pwa': 1,
                        'X-Requested-With': 'XMLHttpRequest',
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
                    },
                });
                return _response.data;
            });
            if (response.data && response.data.data) {
                const comments = response.data.data;
                itemDesc += `<br clear="both" /><div style="clear: both"></div><div style="background: #80808010;border-top:1px solid #80808030;border-bottom:1px solid #80808030;margin:0;padding:5px 20px;">`;
                itemDesc += '<h3>热门评论</h3>';
                for (const comment of comments) {
                    itemDesc += '<p style="margin-bottom: 0.5em;margin-top: 0.5em">';
                    itemDesc += `<a href="https://weibo.com/${comment.user.id}" target="_blank">${comment.user.screen_name}</a>: ${comment.text}`;
                    if (comment.comments) {
                        itemDesc += '<blockquote style="border-left:0.2em solid #80808080; margin-left: 0.3em; padding-left: 0.5em; margin-bottom: 0.5em; margin-top: 0.25em">';
                        for (const com of comment.comments) {
                            itemDesc += '<div style="font-size: 0.9em">';
                            itemDesc += `<a href="https://weibo.com/${com.user.id}" target="_blank">${com.user.screen_name}</a>: ${com.text}`;
                            itemDesc += '</div>';
                        }
                        itemDesc += '</blockquote>';
                    }
                    itemDesc += '</p>';
                }
                itemDesc += '</div>';
            }
        }
        return itemDesc;
    },
    sinaimgTvax: (() => {
        // https://datatracker.ietf.org/doc/html/rfc1808#section-2.4.3
        const regex = /(?<=\/\/)wx(?=[1-4]\.sinaimg\.cn\/)/gi;
        // const prefixes = ['tva', 'tvax'];
        // let cnt = 0;
        // const replace = (html) => {
        //     cnt = (cnt + 1) % 2;
        //     return html.replace(regex, prefixes[cnt]);
        // };
        const replace = (html) => html.replaceAll(regex, 'tvax'); // enforce `tvax` as `tva` has a strict WAF
        const replaceKV = (obj, keys) => {
            for (const key of keys) {
                if (obj[key]) {
                    obj[key] = replace(obj[key]);
                }
            }
        };
        const dataKeys = ['description', 'image'];
        const itemKeys = ['description'];
        return (data) => {
            if (data) {
                replaceKV(data, dataKeys);
                if (data.item) {
                    for (const item of data.item) {
                        replaceKV(item, itemKeys);
                    }
                }
            }
            return data;
        };
    })(),
};

module.exports = weiboUtils;

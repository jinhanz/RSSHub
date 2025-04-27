const querystring = require('query-string');
const got = require('@/utils/got');
const weiboUtils = require('./utils');
const config = require('@/config').value;
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');
const { fallback, queryToBoolean } = require('@/utils/readable-social');

module.exports = async (ctx) => {
    const uid = ctx.params.uid;
    let displayVideo = '1';
    let displayArticle = '0';
    let displayComments = '0';
    let useRepostedUrl = '0';
    if (ctx.params.routeParams) {
        if (ctx.params.routeParams === '1' || ctx.params.routeParams === '0') {
            displayVideo = ctx.params.routeParams;
        } else {
            const routeParams = querystring.parse(ctx.params.routeParams);
            displayVideo = fallback(undefined, queryToBoolean(routeParams.displayVideo), true) ? '1' : '0';
            displayArticle = fallback(undefined, queryToBoolean(routeParams.displayArticle), false) ? '1' : '0';
            displayComments = fallback(undefined, queryToBoolean(routeParams.displayComments), false) ? '1' : '0';
            useRepostedUrl = fallback(undefined, queryToBoolean(routeParams.useRepostedUrl), false) ? '1' : '0';
        }
    }
    const containerData = await ctx.cache.tryGet(
        `weibo:user:index:${uid}`,
        async () => {
            const _r = await got({
                method: 'get',
                url: `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}`,
                headers: {
                    Referer: `https://m.weibo.cn/u/${uid}`,
                    'MWeibo-Pwa': 1,
                    'X-Requested-With': 'XMLHttpRequest',
                    Cookie: config.weibo.cookies,
                },
            });
            return _r.data;
        },
        config.cache.routeExpire,
        false
    );

    const name = containerData.data.userInfo.screen_name;
    const description = containerData.data.userInfo.description;
    const profileImageUrl = containerData.data.userInfo.profile_image_url;
    const containerId = containerData.data.tabsInfo.tabs.find((item) => item.tab_type === 'weibo').containerid;

    const cards = await ctx.cache.tryGet(
        `weibo:user:cards:${uid}:${containerId}`,
        async () => {
            const _r = await got({
                method: 'get',
                url: `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}&containerid=${containerId}`,
                headers: {
                    Referer: `https://m.weibo.cn/u/${uid}`,
                    'MWeibo-Pwa': 1,
                    'X-Requested-With': 'XMLHttpRequest',
                    Cookie: config.weibo.cookies,
                },
            });
            return _r.data.data.cards;
        },
        config.cache.routeExpire,
        false
    );

    let resultItems = await Promise.all(
        cards
            .filter((item) => item.mblog)
            .map(async (item) => {
                // TODO: unify cache key and let weiboUtils.getShowData() handle the cache? It seems safe to do so.
                //       Need more investigation, pending for now since the current version works fine.
                // TODO: getShowData() on demand? The API seems to return most things we need since 2022/05/21.
                //       Need more investigation, pending for now since the current version works fine.
                const key = 'weibo:user:' + item.mblog.bid;
                const data = await ctx.cache.tryGet(key, () => weiboUtils.getShowData(uid, item.mblog.bid));

                if (data && data.text) {
                    item.mblog.text = data.text;
                    item.mblog.created_at = parseDate(data.created_at);
                    item.mblog.pics = data.pics;
                    if (item.mblog.retweeted_status && data.retweeted_status) {
                        item.mblog.retweeted_status.created_at = data.retweeted_status.created_at;
                    }
                } else {
                    item.mblog.created_at = timezone(item.mblog.created_at, +8);
                }

                // 转发的长微博处理
                const retweet = item.mblog.retweeted_status;
                if (retweet && retweet.isLongText) {
                    // TODO: unify cache key and ...
                    const retweetData = await ctx.cache.tryGet(`weibo:retweeted:${retweet.user.id}:${retweet.bid}`, () => weiboUtils.getShowData(retweet.user.id, retweet.bid));
                    if (retweetData !== undefined && retweetData.text) {
                        item.mblog.retweeted_status.text = retweetData.text;
                    }
                }

                const formatExtended = weiboUtils.formatExtended(ctx, item.mblog, uid);
                let description = formatExtended.description;
                const title = formatExtended.title;
                const pubDate = formatExtended.pubDate;

                // 视频的处理
                if (displayVideo === '1') {
                    // 含被转发微博时需要从被转发微博中获取视频
                    description = item.mblog.retweeted_status ? weiboUtils.formatVideo(description, item.mblog.retweeted_status) : weiboUtils.formatVideo(description, item.mblog);
                }

                // 评论的处理
                if (displayComments === '1') {
                    description = await weiboUtils.formatComments(ctx, description, item.mblog);
                }

                // 文章的处理
                if (displayArticle === '1') {
                    // 含被转发微博时需要从被转发微博中获取文章
                    description = await (item.mblog.retweeted_status ? weiboUtils.formatArticle(ctx, description, item.mblog.retweeted_status) : weiboUtils.formatArticle(ctx, description, item.mblog));
                }

                // Shaderein: For some accounts I want the original post's
                //  url be identified as the feed item's url
                // Shaderein: original link foramt can't be parsed by cuboc
                // `https://weibo.com/${uid}/${item.mblog.bid}`
                link = `https://weibo.com/${uid}/${item.mblog.bid}`;
                // If choose to use retweeted status url in feed, put original url at the bottom
                if (retweet && useRepostedUrl === '1') {
                    description = description + `<a href="${link}">转发此条的微博</a>`;
                    link = `https://weibo.com/${item.mblog.retweeted_status.user.id}/${item.mblog.retweeted_status.bid}`;
                }

                return {
                    title,
                    description,
                    link, // can't use guid if wan't to use retweeted post url
                    pubDate,
                    author: formatExtended.author,
                    isPinned: item.profile_type_id?.startsWith('proweibotop'),
                };
            })
    );

    // remove pinned weibo if they are too old (older than all the rest weibo)
    // the character of pinned weibo is `card.profile_type_id.startsWith('proweibotop')`
    // there can be 1 or 2 (WHAT A FANTASTIC BRAIN THE PM HAS?) pinned weibo at the same time
    const pinnedItems = resultItems.filter((item) => item.isPinned);
    const ordinaryItems = resultItems.filter((item) => !item.isPinned);
    if (pinnedItems.length > 0 && ordinaryItems.length > 0 && Math.max(...pinnedItems.map((i) => i.pubDate).filter(Boolean)) < Math.min(...ordinaryItems.map((i) => i.pubDate).filter(Boolean))) {
        resultItems = ordinaryItems;
    }

    const profile_photo =  config.hotlink.template ? config.hotlink.template.replace('${href_ue}',encodeURIComponent(profileImageUrl)) : profileImageUrl;

    ctx.state.data = weiboUtils.sinaimgTvax({
        title: `${name}的微博`,
        link: `https://weibo.com/${uid}/`,
        description,
        image: profile_photo,
        icon: profile_photo,
        logo: profile_photo,
        item: resultItems,
    });
};

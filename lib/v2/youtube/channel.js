const utils = require('./utils');
const config = require('@/config').value;
const { parseDate } = require('@/utils/parse-date');
const querystring = require('querystring');


module.exports = async (ctx) => {
    if (!config.youtube || !config.youtube.key) {
        throw 'YouTube RSS is disabled due to the lack of <a href="https://docs.rsshub.app/install/#pei-zhi-bu-fen-rss-mo-kuai-pei-zhi">relevant config</a>';
    }
    const id = ctx.params.id;
    const routeParams = querystring.parse(ctx.params.routeParams);

    // Add year to title for more accurate searching
    const embed = routeParams.embed ? routeParams.embed === 'true' || routeParams.embed === '1' : true;
    const translate = routeParams.translate ? routeParams.translate === 'true' || routeParams.translate === '1' : false;
    const language = routeParams.language ? routeParams.language : 'en';

    // taken from https://webapps.stackexchange.com/a/101153
    if (!/^UC[\w-]{21}[AQgw]$/.test(id)) {
        throw `Invalid YouTube channel ID. \nYou may want to use <a href="/youtube/user/${id}">/youtube/user/${id}</a> instead.`;
    }

    const playlistId = (await utils.getChannelWithId(id, 'contentDetails', ctx.cache)).data.items[0].contentDetails.relatedPlaylists.uploads;

    let data = (await utils.getPlaylistItems(playlistId, 'snippet', ctx.cache)).data.items;
    if (translate) {
        const videoIds = data.map((d) => d.snippet.resourceId.videoId).join(',');
        data = (await utils.getVideoInfo(videoIds, 'snippet,localizations', ctx.cache)).data.items;
    }

    ctx.state.data = {
        title: `${data[0].snippet.channelTitle} - YouTube`,
        link: `https://www.youtube.com/channel/${id}`,
        description: `YouTube channel ${data[0].snippet.channelTitle}`,
        item: data
            .filter((d) => d.snippet.title !== 'Private video' && d.snippet.title !== 'Deleted video')
            .map((item) => {
                const snippet = item.snippet;
                const videoId = translate ? item.id : snippet.resourceId.videoId;
                const img = utils.getThumbnail(snippet.thumbnails);

                const localization = translate ? item.localizations[language] : null;
                const title = localization ? localization.title : snippet.title;
                const description = localization ? localization.description : snippet.description;

                return {
                    title,
                    description: utils.renderDescription(embed, videoId, img, utils.formatDescription(description)),
                    pubDate: parseDate(snippet.publishedAt),
                    link: `https://www.youtube.com/watch?v=${videoId}`,
                    author: snippet.videoOwnerChannelTitle,
                };
            }),
    };
};

const iframe = (aid, page, bvid) =>
    `<iframe src="https://api.injahow.cn/bparse/?${bvid ? `bv=${bvid}` : `av=${aid}`}${
        page ? `&p=${page}` : ''}&q=80&otype=dplayer" style="width:100%; height: 196!important;" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>`;
module.exports = {
    iframe,
    bvidTime: 1589990400,
};
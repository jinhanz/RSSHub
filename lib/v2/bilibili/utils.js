const md5 = require('@/utils/md5');

const iframe = (aid, page, bvid) =>
    `<iframe src="https://api.injahow.cn/bparse/?${bvid ? `bv=${bvid}` : `av=${aid}`}${
        page ? `&p=${page}` : ''
    }&q=80&otype=dplayer" style="width:100%; height: 196!important;" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>`;

const addVerifyInfo = (params, verifyString) => {
    const searchParams = new URLSearchParams(params);
    searchParams.sort();
    const verifyParam = searchParams.toString();
    const wts = Math.round(Date.now() / 1000);
    const w_rid = md5(`${verifyParam}&wts=${wts}${verifyString}`);
    return `${params}&w_rid=${w_rid}&wts=${wts}`;
};

module.exports = {
    iframe,
    addVerifyInfo,
    bvidTime: 1589990400,
};
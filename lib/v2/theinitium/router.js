module.exports = (router) => {
    router.get('/tgchannel', require('./tgchannel'));
    router.get('/:model?/:type?/:language?', require('./full'));
};

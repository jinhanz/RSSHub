const category = require('@/routes/199it/category');
const category_url = require('@/routes/pornhub/category_url');
const got = require('@/utils/got');

module.exports = async (ctx) => {
    // realtimehot:主榜 fun:文娱榜
    if (ctx.params.type) {var type = ctx.params.type;}
    else {var type='realtimehot';}
    
    if (type=='fun') {var category = 'entrank'; }
    else {var category = type;}
        
    const {
        data: { data },
    } = await got({
        method: 'get',
        url: `https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3D${type}&title=%E5%BE%AE%E5%8D%9A%E7%83%AD%E6%90%9C&extparam=filter_type%3D${type}%26mi_cid%3D100103%26pos%3D0_0%26c_type%3D30%26display_time%3D1540538388&luicode=10000011&lfid=231583`,
        headers: {
            Referer: `https://s.weibo.com/top/summary?cate=${category}`,
            'MWeibo-Pwa': 1,
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
        },
    });

    if (type=='realtimehot'){feed_title = '微博热搜榜';}
    else if (type=='fun'){feed_title = '微博文娱榜';}
    

    ctx.state.data = {
        title: feed_title,
        link: `https://s.weibo.com/top/summary?cate=${category}`,
        description: '实时热点，每分钟更新一次',
        item: data.cards[0].card_group.map((item) => {
            const title = item.desc;
            const link = `https://m.weibo.cn/search?containerid=100103type%3D1%26q%3D${encodeURIComponent(item.desc)}`;
            const description = item.desc;

            return {
                title,
                description,
                link,
            };
        }),
    };
};

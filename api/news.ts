// /api/news.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const RSS_FEEDS = [
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/group/ai-artificial-intelligence/index.xml' },
  { name: 'Ars Technica AI', url: 'https://arstechnica.com/information-technology/artificial-intelligence/feed/' },
];

const RSS_PROXY_URL = 'https://api.rss2json.com/v1/api.json?rss_url=';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const feedPromises = RSS_FEEDS.map(feed =>
            fetch(`${RSS_PROXY_URL}${encodeURIComponent(feed.url)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch RSS feed: ${feed.name}`);
                    }
                    return response.json();
                })
                .then(data => data.items?.map((item: any) => ({
                    ...item,
                    source: feed.name,
                    content: item.content || item.description,
                })) || [])
        );

        const allItems = (await Promise.all(feedPromises)).flat();
        const uniqueItems = Array.from(new Map(allItems.map(item => [item.guid || item.link, item])).values());
        const sortedItems = uniqueItems
            .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
            .slice(0, 15); // 더 많은 기사를 가져오도록 15개로 늘립니다.

        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate'); // 10분 캐시
        res.status(200).json(sortedItems);

    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch news headlines.' });
    }
}

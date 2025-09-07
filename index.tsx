import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// 앱 접근을 허용할 이메일 목록
const ALLOWED_EMAILS = [
  'nanarago@gmail.com',
  // 여기에 6명의 다른 팀원 이메일을 추가할 수 있습니다.
  // 'user2@example.com',
  // 'user3@example.com',
];

// RSS 피드 소스 정의
const RSS_FEEDS = [
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/group/ai-artificial-intelligence/index.xml' },
  { name: 'Ars Technica AI', url: 'https://arstechnica.com/information-technology/artificial-intelligence/feed/' },
];

const RSS_PROXY_URL = 'https://api.rss2json.com/v1/api.json?rss_url=';

interface Article {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  content: string;
  guid: string;
}

const App = () => {
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [summary, setSummary] = useState('');
  const [isLoadingHeadlines, setIsLoadingHeadlines] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  useEffect(() => {
    // 앱 시작 시 로컬 저장소에서 로그인 정보 확인
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && ALLOWED_EMAILS.includes(storedUser)) {
      setLoggedInUser(storedUser);
    }
  }, []);

  const handleLogin = () => {
    if (ALLOWED_EMAILS.includes(emailInput.toLowerCase())) {
      localStorage.setItem('loggedInUser', emailInput.toLowerCase());
      setLoggedInUser(emailInput.toLowerCase());
      setLoginError('');
    } else {
      setLoginError('접근 권한이 없는 이메일입니다.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    setLoggedInUser(null);
    setEmailInput('');
  };
  
  const fetchNews = useCallback(async () => {
    setIsLoadingHeadlines(true);
    setError('');
    try {
      const feedPromises = RSS_FEEDS.map(feed =>
        fetch(`${RSS_PROXY_URL}${encodeURIComponent(feed.url)}`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`Failed to fetch RSS feed: ${feed.name}`);
            }
            return res.json();
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
        .slice(0, 5);

      setArticles(sortedItems as Article[]);
    } catch (err) {
      console.error(err);
      setError('뉴스 헤드라인을 가져오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsLoadingHeadlines(false);
    }
  }, []);

  useEffect(() => {
    if (loggedInUser) {
        fetchNews();
    }
  }, [loggedInUser, fetchNews]);

  const handleArticleSelect = async (article: Article) => {
    if (selectedArticle?.guid === article.guid) return;

    setSelectedArticle(article);
    setIsLoadingSummary(true);
    setSummary('');
    setSummaryError('');

    try {
        const prompt = `다음 기사를 한국어로 요약해줘. A4 용지 1/3 분량 정도로, 구독자가 기억해야 할 핵심 중요 단어는 **굵은 글씨**로 강조해서 작성해줘. 응답의 첫 줄에 '## 제목' 형식으로 요약의 제목을 추가해줘.\n\n기사 제목: ${article.title}\n기사 내용: ${article.content.replace(/<[^>]*>?/gm, ' ')}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        
        let summaryText = response.text;
        const lines = summaryText.split('\n');
        const titleIndex = lines.findIndex(line => line.trim().startsWith('##'));

        let finalHtml;
        if (titleIndex !== -1) {
            const titleLine = lines[titleIndex];
            const title = titleLine.replace(/##/g, '').trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            lines.splice(titleIndex, 1);
            const body = lines.join('\n');
            const processedBody = body.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
            
            finalHtml = `<h3 class="summary-title">${title}</h3><div class="summary-body">${processedBody}</div>`;
        } else {
            const processedText = summaryText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
            finalHtml = `<div class="summary-body">${processedText}</div>`;
        }
        
        setSummary(finalHtml);

    } catch (err) {
      console.error(err);
      setSummaryError('기사 요약에 실패했습니다. 다른 기사를 선택해 주세요.');
    } finally {
      setIsLoadingSummary(false);
    }
  };
  
  if (!loggedInUser) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>AI 뉴스 요약</h1>
          <p>접근을 위해 허용된 이메일을 입력하세요.</p>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="your-email@example.com"
            aria-label="Email for login"
          />
          <button onClick={handleLogin}>로그인</button>
          {loginError && <p className="error-message login-error">{loginError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="app-header">
        <h1>AI 뉴스 요약</h1>
        <div className="user-info">
          <span>{loggedInUser}</span>
          <button onClick={handleLogout} className="logout-button">로그아웃</button>
        </div>
      </header>
      <main className="content">
        <aside className="headlines-panel">
          <h2>Top 5 AI 뉴스 헤드라인</h2>
          {isLoadingHeadlines ? (
            <div className="skeleton-container">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton-item"></div>)}
            </div>
          ) : error ? (
            <p className="error-message">{error}</p>
          ) : (
            <ul>
              {articles.map((article) => (
                <li
                  key={article.guid}
                  className={selectedArticle?.guid === article.guid ? 'active' : ''}
                  onClick={() => handleArticleSelect(article)}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleArticleSelect(article)}
                  aria-selected={selectedArticle?.guid === article.guid}
                  role="button"
                >
                  {article.title} <strong className="source-tag">[{article.source}]</strong>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="summary-panel">
          <h2>기사 요약</h2>
          <div className="summary-content">
            {isLoadingSummary ? (
              <div className="spinner-container">
                <div className="spinner"></div>
                <p>요약 중입니다...</p>
              </div>
            ) : summaryError ? (
               <p className="error-message">{summaryError}</p>
            ) : summary ? (
              <div dangerouslySetInnerHTML={{ __html: summary }} />
            ) : (
              <p className="placeholder">왼쪽 목록에서 기사를 선택하여 요약을 확인하세요.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// 앱 접근을 허용할 이메일 목록
const ALLOWED_EMAILS = [
  'nanarago@gmail.com',
  'lorenzo.sohn@lge.com',
  'kukdong.bae@lge.com',
  'irene.hwang@lge.com',
  'jeongmin.hong@lge.com',
  'daejoong.yoon@lge.com',
  'jg.kwon@lge.com',
  'kwanhee.lee@lge.com',
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
        
        const text = response.text;
        setSummary(text);

    } catch (err) {
        console.error("요약 생성 오류:", err);
        setSummaryError('기사 요약에 실패했습니다. 모델 API에 문제가 있을 수 있습니다.');
    } finally {
        setIsLoadingSummary(false);
    }
  };
  
  const parseSummary = (rawSummary: string) => {
    const titleMatch = rawSummary.match(/^##\s*(.*)/);
    const title = titleMatch ? titleMatch[1] : '요약';
    const content = titleMatch ? rawSummary.substring(titleMatch[0].length).trim() : rawSummary;
    const formattedContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return { title, formattedContent };
  };

  if (!loggedInUser) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>AI 뉴스 요약</h1>
          <p>로그인하여 최신 AI 뉴스를 확인하세요.</p>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="이메일 주소를 입력하세요"
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin}>로그인</button>
          {loginError && <p className="error-message login-error">{loginError}</p>}
        </div>
      </div>
    );
  }

  const { title: summaryTitle, formattedContent: summaryBody } = parseSummary(summary);

  return (
    <div className="container">
      <header className="app-header">
        <h1>AI 뉴스 요약</h1>
        <div className="user-info">
            <span>{loggedInUser}</span>
            <button className="logout-button" onClick={handleLogout}>로그아웃</button>
        </div>
      </header>
      <main className="content">
        <aside className="headlines-panel">
          <h2>최신 AI 뉴스</h2>
          {isLoadingHeadlines ? (
             <div className="skeleton-container">
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton-item" />)}
            </div>
          ) : error ? (
            <p className="error-message">{error}</p>
          ) : (
            <ul>
              {articles.map(article => (
                <li
                  key={article.guid}
                  className={selectedArticle?.guid === article.guid ? 'active' : ''}
                  onClick={() => handleArticleSelect(article)}
                  tabIndex={0}
                  onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && handleArticleSelect(article)}
                  aria-label={`기사 선택: ${article.title}`}
                >
                    <div>{article.title}</div>
                    <small><span className="source-tag">{article.source}</span> - {new Date(article.pubDate).toLocaleDateString()}</small>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="summary-panel">
          <h2>기사 요약</h2>
          {isLoadingSummary ? (
            <div className="spinner-container">
              <div className="spinner"></div>
              <p>AI가 기사를 요약하고 있습니다...</p>
            </div>
          ) : summaryError ? (
            <p className="error-message">{summaryError}</p>
          ) : selectedArticle ? (
            <div className="summary-content">
              <h3 className="summary-title">{summaryTitle}</h3>
              <p dangerouslySetInnerHTML={{ __html: summaryBody }}></p>
              <a href={selectedArticle.link} target="_blank" rel="noopener noreferrer">원본 기사 읽기</a>
            </div>
          ) : (
            <p className="placeholder">왼쪽 목록에서 기사를 선택하여 요약을 확인하세요.</p>
          )}
        </section>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
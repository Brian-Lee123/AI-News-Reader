
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

type SummaryLength = 'short' | 'medium' | 'long';

const ShareModal = ({ article, onClose }: { article: Article, onClose: () => void }) => {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
           if (event.key === 'Escape') {
              onClose();
           }
        };
        window.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    const copyLink = () => {
        navigator.clipboard.writeText(article.link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(article.link)}&text=${encodeURIComponent(article.title)}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(article.link)}`;
    const emailUrl = `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(`Check out this article: ${article.link}`)}`;

    return (
        <div className="share-modal-overlay" onClick={onClose}>
            <div className="share-modal" onClick={(e) => e.stopPropagation()}>
                <div className="share-modal-header">
                    <h4>기사 공유하기</h4>
                    <button onClick={onClose} className="close-button" aria-label="닫기">&times;</button>
                </div>
                <p className="share-modal-article-title">{article.title}</p>
                <div className="share-modal-body">
                    <ul className="share-options">
                        <li><button onClick={copyLink} className="share-option-button">{copied ? '복사 완료!' : '링크 복사'}</button></li>
                        <li><a href={emailUrl} className="share-option-button">이메일</a></li>
                        <li><a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="share-option-button">트위터</a></li>
                        <li><a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="share-option-button">페이스북</a></li>
                    </ul>
                </div>
            </div>
        </div>
    );
};


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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');

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

  const handleArticleSelect = (article: Article) => {
    if (selectedArticle?.guid === article.guid) return;
    setSelectedArticle(article);
  };

  useEffect(() => {
    const generateSummary = async () => {
      if (!selectedArticle) return;

      setIsLoadingSummary(true);
      setSummary('');
      setSummaryError('');

      const getPromptForLength = (length: SummaryLength, article: Article): string => {
        let lengthInstruction = '';
        switch (length) {
          case 'short':
            lengthInstruction = '3-5 문장의 짧은 단락으로';
            break;
          case 'long':
            lengthInstruction = 'A4 용지 1/2 분량 정도로 상세하게';
            break;
          case 'medium':
          default:
            lengthInstruction = 'A4 용지 1/3 분량 정도로';
            break;
        }
        return `다음 기사를 한국어로 요약해줘. ${lengthInstruction}, 구독자가 기억해야 할 핵심 중요 단어는 **굵은 글씨**로 강조해서 작성해줘. 응답의 첫 줄에 '## 제목' 형식으로 요약의 제목을 추가해줘.\n\n기사 제목: ${article.title}\n기사 내용: ${article.content.replace(/<[^>]*>?/gm, ' ')}`;
      };

      try {
        const prompt = getPromptForLength(summaryLength, selectedArticle);

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

    generateSummary();
  }, [selectedArticle, summaryLength, ai.models]);
  
  const handleShare = async () => {
    if (!selectedArticle) return;

    const shareData = {
        title: selectedArticle.title,
        text: `Check out this AI news article: ${selectedArticle.title}`,
        url: selectedArticle.link,
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            console.log("Share canceled or failed", err);
        }
    } else {
        setIsShareModalOpen(true);
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
          <div className="summary-header">
            <h2>기사 요약</h2>
            <div className="summary-length-controls">
              <button className={`length-btn ${summaryLength === 'short' ? 'active' : ''}`} onClick={() => setSummaryLength('short')}>짧게</button>
              <button className={`length-btn ${summaryLength === 'medium' ? 'active' : ''}`} onClick={() => setSummaryLength('medium')}>보통</button>
              <button className={`length-btn ${summaryLength === 'long' ? 'active' : ''}`} onClick={() => setSummaryLength('long')}>길게</button>
            </div>
          </div>

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
              <div dangerouslySetInnerHTML={{ __html: summaryBody }}></div>
              <div className="summary-actions">
                <a href={selectedArticle.link} target="_blank" rel="noopener noreferrer" className="action-link">원본 기사 읽기</a>
                <button className="share-button" onClick={handleShare}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5m-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"/>
                  </svg>
                  <span>공유하기</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="placeholder">왼쪽 목록에서 기사를 선택하여 요약을 확인하세요.</p>
          )}
        </section>
      </main>
       {isShareModalOpen && selectedArticle && (
        <ShareModal article={selectedArticle} onClose={() => setIsShareModalOpen(false)} />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);

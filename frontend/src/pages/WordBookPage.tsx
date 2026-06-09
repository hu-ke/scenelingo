import { useEffect, useState } from 'react';
import { useReview } from '../context/ReviewContext';
import type { PhotoItem } from '../context/ReviewContext';
import { getAllPhotos, isLoggedIn } from '../utils/indexedDB';
import { api } from '../utils/api';
import { isMastered, toggleMastered } from '../utils/wordMastery';

interface WordEntry {
  word: string;
  phonetic: string;
  examples: string[];
  photoCount: number;
  photoIds: string[];
}

// 获取日期字符串 YYYY-MM-DD
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 获取前N天的日期
function getDateBefore(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getDateString(date);
}

export default function WordBookPage() {
  const { dispatch } = useReview();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'mastered'>('new');
  // @ts-ignore
  const [refresh, setRefresh] = useState(0);
  const [loadedDays, setLoadedDays] = useState(0); // 已加载的天数（0表示今天和昨天）
  const [hasMore, setHasMore] = useState(true); // 是否还有更多数据可加载

  // 加载指定日期范围的照片
  const loadPhotosByDateRange = async (startDate: string, endDate: string): Promise<PhotoItem[]> => {
    if (isLoggedIn()) {
      try {
        const result = await api.listPhotos(startDate, endDate);
        return result.photos.map((p: any) => ({
          id: p.id,
          dataUrl: p.originalUrl,
          annotatedDataUrl: p.annotatedUrl,
          objects: p.objects,
        }));
      } catch (err) {
        console.error('[WordBook] 云端加载失败:', err);
        return [];
      }
    }
    return [];
  };

  // 从照片中提取单词
  const extractWordsFromPhotos = (photos: PhotoItem[], existingWords: Map<string, WordEntry>): Map<string, WordEntry> => {
    const wordMap = new Map(existingWords);

    for (const photo of photos) {
      if (!photo.objects || !Array.isArray(photo.objects)) continue;

      for (const obj of photo.objects) {
        if (!obj || !obj.name || typeof obj.name !== 'string') {
          console.warn('[WordBook] 跳过无效 object:', obj);
          continue;
        }
        const key = obj.name.toLowerCase();

        const existing = wordMap.get(key);
        if (existing) {
          if (!existing.photoIds.includes(photo.id)) {
            existing.photoIds.push(photo.id);
            existing.photoCount = existing.photoIds.length;
          }
          if (existing.examples.length === 0 && obj.examples && obj.examples.length > 0) {
            existing.examples = obj.examples;
          }
          if (existing.phonetic === '' && typeof obj.phonetic === 'string' && obj.phonetic !== '') {
            existing.phonetic = obj.phonetic;
          }
        } else {
          wordMap.set(key, {
            word: obj.name,
            phonetic: typeof obj.phonetic === 'string' ? obj.phonetic : '',
            examples: Array.isArray(obj.examples) ? obj.examples : [],
            photoCount: 1,
            photoIds: [photo.id],
          });
        }
      }
    }

    return wordMap;
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialWords() {
      try {
        setLoading(true);
        
        // 先加载今天和昨天的数据
        const today = getDateString(new Date());
        const yesterday = getDateBefore(1);
        
        console.log('[WordBook] 加载今天和昨天的数据:', yesterday, today);
        
        let photos: PhotoItem[] = [];
        
        if (isLoggedIn()) {
          photos = await loadPhotosByDateRange(yesterday, today);
        } else {
          // 未登录时，从本地加载所有数据
          photos = await getAllPhotos();
        }

        if (cancelled) return;

        console.log('[WordBook] 初始加载照片数:', photos.length);

        const wordMap = extractWordsFromPhotos(photos, new Map());
        console.log('[WordBook] 提取到不重复单词数:', wordMap.size);

        const sorted = Array.from(wordMap.values()).sort((a, b) =>
          a.word.toLowerCase().localeCompare(b.word.toLowerCase())
        );

        if (!cancelled) {
          setWords(sorted);
          setLoadedDays(2); // 已加载今天和昨天（2天）
          setHasMore(isLoggedIn()); // 只有登录用户才支持按需加载更多
        }
      } catch (err) {
        console.error('[WordBook] 加载单词失败:', err);
        if (!cancelled) {
          setWords([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialWords();

    return () => {
      cancelled = true;
    };
  }, []);

  // 加载更多（更早的数据）
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      
      // 计算下一个要加载的日期范围
      // 例如：已加载今天和昨天（0-1），接下来加载前天（2）
      const nextDay = loadedDays;
      const startDate = getDateBefore(nextDay);
      const endDate = startDate;
      
      console.log('[WordBook] 加载更多数据:', startDate);
      
      const photos = await loadPhotosByDateRange(startDate, endDate);
      
      console.log('[WordBook] 加载更多照片数:', photos.length);
      
      if (photos.length === 0) {
        // 如果没有数据，说明已经加载完了
        setHasMore(false);
      } else {
        // 提取单词并合并到现有数据
        const currentWordMap = new Map<string, WordEntry>();
        words.forEach(w => currentWordMap.set(w.word.toLowerCase(), w));
        
        const newWordMap = extractWordsFromPhotos(photos, currentWordMap);
        
        const sorted = Array.from(newWordMap.values()).sort((a, b) =>
          a.word.toLowerCase().localeCompare(b.word.toLowerCase())
        );
        
        setWords(sorted);
        setLoadedDays(prev => prev + 1);
      }
    } catch (err) {
      console.error('[WordBook] 加载更多失败:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const newWords = words.filter((w) => !isMastered(w.word));
  const masteredWords = words.filter((w) => isMastered(w.word));
  const displayWords = activeTab === 'new' ? newWords : masteredWords;

  const handleWordClick = (wordName: string) => {
    dispatch({ type: 'setWordDetail', word: wordName });
    dispatch({ type: 'setPage', page: 'worddetail' });
  };

  const handleToggle = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    toggleMastered(word);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="page" style={{ animation: 'fadeIn 0.4s ease' }}>
      <div className="home-header" style={{ position: 'relative' }}>
        <button
          onClick={() => dispatch({ type: 'setPage', page: 'home' })}
          style={{
            position: 'absolute',
            top: '50%',
            left: 'var(--space-md)',
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '1.25rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderRadius: '50%',
            width: 36,
            height: 36,
            minHeight: 36,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            backdropFilter: 'blur(4px)',
          }}
          title="返回首页"
        >
          ←
        </button>
        <h1>我的单词本</h1>
        <p>
          {loading
            ? '加载中...'
            : words.length > 0
              ? `共 ${words.length} 个单词`
              : '暂无单词'}
        </p>
      </div>

      {!loading && words.length > 0 && (
        <div
          style={{
            display: 'flex',
            borderBottom: '2px solid var(--color-border)',
          }}
        >
          <button
            onClick={() => setActiveTab('new')}
            style={{
              flex: 1,
              padding: '0.75rem 0',
              border: 'none',
              background: 'none',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'new' ? 700 : 500,
              color: activeTab === 'new' ? 'var(--color-primary-start)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              borderBottom: activeTab === 'new' ? '3px solid var(--color-primary-start)' : '3px solid transparent',
              transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            生词表 ({newWords.length})
          </button>
          <button
            onClick={() => setActiveTab('mastered')}
            style={{
              flex: 1,
              padding: '0.75rem 0',
              border: 'none',
              background: 'none',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'mastered' ? 700 : 500,
              color: activeTab === 'mastered' ? 'var(--color-primary-start)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              borderBottom: activeTab === 'mastered' ? '3px solid var(--color-primary-start)' : '3px solid transparent',
              transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            已掌握 ({masteredWords.length})
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div className="spinner" />
        </div>
      ) : words.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">📖</span>
          <p className="empty-state__text">
            还没有学习任何单词，快去拍照探索吧！
          </p>
        </div>
      ) : displayWords.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">
            {activeTab === 'new' ? '🎉' : '💪'}
          </span>
          <p className="empty-state__text">
            {activeTab === 'new'
              ? '太棒了，所有单词都已掌握！🎉'
              : '还没有已掌握的单词，继续加油💪'}
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
            }}
          >
            {displayWords.map((entry, index) => (
              <div
                key={entry.word}
                className="card"
                onClick={() => handleWordClick(entry.word)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  animation: `fadeIn 0.3s ease ${index * 0.05}s both`,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform =
                    'translateY(-2px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    '0 4px 20px rgba(255, 107, 107, 0.12)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = '';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      background:
                        'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      marginBottom: '0.15rem',
                    }}
                  >
                    {entry.word}
                  </div>
                  {entry.phonetic && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      {entry.phonetic}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => handleToggle(e, entry.word)}
                  style={{
                    flexShrink: 0,
                    width: 70,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.35em 0.5em',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    cursor: 'pointer',
                    marginRight: '0.5rem',
                    background:
                      activeTab === 'new'
                        ? 'linear-gradient(135deg, #4CAF50, #66BB6A)'
                        : 'linear-gradient(135deg, #FF9800, #FFB74D)',
                    color: '#FFFFFF',
                    transition: 'opacity 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                  }}
                >
                  {activeTab === 'new' ? '✓ 已掌握' : '↩ 移回生词表'}
                </button>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.25em 0.7em',
                    borderRadius: 'var(--radius-full)',
                    background:
                      'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-mid))',
                    color: '#FFFFFF',
                  }}
                >
                  {entry.photoCount} 张
                </span>
              </div>
            ))}
          </div>
          
          {/* 加载更多按钮 */}
          {hasMore && isLoggedIn() && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: loadingMore
                    ? 'var(--color-border)'
                    : 'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))',
                  color: '#FFFFFF',
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  opacity: loadingMore ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loadingMore) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(255, 107, 107, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = '';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                }}
              >
                {loadingMore ? '加载中...' : '加载更多'}
              </button>
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                已加载 {loadedDays} 天的数据
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
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

export default function WordBookPage() {
  const { dispatch } = useReview();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'new' | 'mastered'>('new');
  // @ts-ignore
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadWords() {
      try {
        let allPhotos: PhotoItem[] = [];

        if (isLoggedIn()) {
          try {
            const result = await api.listPhotos();
            allPhotos = result.photos.map((p: any) => ({
              id: p.id,
              dataUrl: p.originalUrl,
              annotatedDataUrl: p.annotatedUrl,
              objects: p.objects,
            }));
          } catch (err) {
            console.error('[WordBook] 云端加载失败，尝试本地:', err);
            allPhotos = await getAllPhotos();
          }
        } else {
          allPhotos = await getAllPhotos();
        }
        if (cancelled) return;

        console.log('[WordBook] getAllPhotos 返回照片数:', allPhotos.length);
        console.log('[WordBook] 第一张照片:', JSON.stringify(allPhotos[0]?.objects?.slice(0, 1)));

        const wordMap = new Map<string, WordEntry>();

        for (const photo of allPhotos) {
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

        console.log('[WordBook] 提取到不重复单词数:', wordMap.size);

        const sorted = Array.from(wordMap.values()).sort((a, b) =>
          a.word.toLowerCase().localeCompare(b.word.toLowerCase())
        );

        if (!cancelled) {
          setWords(sorted);
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

    loadWords();

    return () => {
      cancelled = true;
    };
  }, []);

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
      )}
    </div>
  );
}
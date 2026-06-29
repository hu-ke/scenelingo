import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getApiBaseUrl } from '../utils/api'
import { getTtsLang, getLanguagePrefs } from '../utils/languagePrefs'
import { isInWordbookList, toggleWordbook } from '../utils/wordMastery'

interface WordObj {
  name: string
  chinese?: string
  phonetic?: string
  examples?: string[]
  romaji?: string
}

interface WordCardProps {
  obj: WordObj
  wordbookWords: string[]
  onWordbookChange?: (word: string, inWordbook: boolean) => void
}

const WordCard: React.FC<WordCardProps> = ({ obj, wordbookWords, onWordbookChange }) => {
  const [inWordbook, setInWordbook] = useState(false)

  useEffect(() => {
    setInWordbook(isInWordbookList(obj.name, wordbookWords))
  }, [obj.name, wordbookWords])
  const { name, chinese, phonetic, examples } = obj

  const handleToggle = () => setExpanded((prev) => !prev)

  const handleSpeak = (e: any) => {
    e.stopPropagation()
    try {
      Taro.setInnerAudioOption({ obeyMuteSwitch: false })
      const audioCtx = Taro.createInnerAudioContext()
      const ttsLang = getTtsLang(getLanguagePrefs().targetLang)
      const baseUrl = getApiBaseUrl()
      audioCtx.src = `${baseUrl}/api/tts?text=${encodeURIComponent(name)}&lang=${ttsLang}`
      audioCtx.play()
      audioCtx.onEnded(() => audioCtx.destroy())
      audioCtx.onError(() => {
        audioCtx.destroy()
        Taro.showToast({ title: '发音失败，请检查是否处于静音模式', icon: 'none', duration: 2000 })
      })
    } catch {
      Taro.showToast({ title: '发音失败', icon: 'none' })
    }
  }

  const handleToggleWordbook = async (e: any) => {
    e.stopPropagation()
    try {
      const nowIn = await toggleWordbook(name, inWordbook)
      setInWordbook(nowIn)
      onWordbookChange?.(name, nowIn)
      if (nowIn) {
        Taro.showToast({ title: '已加入生词本', icon: 'success', duration: 1500 })
      } else {
        Taro.showToast({ title: '已移出生词本', icon: 'none', duration: 1500 })
      }
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const [expanded, setExpanded] = useState(false)

  return (
    <View
      onClick={handleToggle}
      style={{
        background: '#fff',
        borderRadius: '10rpx',
        padding: '14rpx 20rpx',
        boxShadow: '0 1rpx 6rpx rgba(0,0,0,0.05)',
        textAlign: 'center',
        minWidth: '150rpx',
      }}
    >
      <Text style={{ fontWeight: 700, fontSize: '28rpx', color: '#333' }}>
        {name}
      </Text>
      {chinese && (
        <Text style={{ display: 'block', fontSize: '24rpx', color: '#667eea', fontWeight: 500, marginTop: '2rpx' }}>
          {chinese}
        </Text>
      )}
      <Text style={{ display: 'block', fontSize: '22rpx', color: '#888', marginTop: '2rpx' }}>
        {phonetic || ''}
      </Text>
      {obj.romaji ? (
        <Text style={{ display: 'block', fontSize: '20rpx', color: '#aaa', marginTop: '1rpx' }}>
          {obj.romaji}
        </Text>
      ) : null}
      <View style={{ display: 'flex', justifyContent: 'center', gap: '12rpx', marginTop: '6rpx' }}>
        <View
          onClick={handleSpeak}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24rpx',
            padding: '4rpx',
          }}
        >
          🔊
        </View>
        <View
          onClick={handleToggleWordbook}
          style={{
            background: inWordbook ? '#e8f5e9' : '#f5f5f5',
            border: inWordbook ? '1rpx solid #4caf50' : '1rpx solid #ddd',
            borderRadius: '6rpx',
            fontSize: '20rpx',
            padding: '4rpx 10rpx',
            color: inWordbook ? '#4caf50' : '#999',
            whiteSpace: 'nowrap',
          }}
        >
          {inWordbook ? '📖 已加入' : '+ 生词本'}
        </View>
      </View>
      {expanded && examples && examples.length > 0 && (
        <View style={{
          marginTop: '10rpx',
          paddingTop: '10rpx',
          borderTop: '1rpx solid #eee',
          textAlign: 'left',
          fontSize: '22rpx',
          color: '#666',
        }}>
          {examples.map((ex, i) => (
            <View key={i} style={{ marginBottom: '6rpx', display: 'flex', alignItems: 'flex-start', gap: '6rpx' }}>
              <Text style={{ flexShrink: 0 }}>📖</Text>
              <Text style={{ lineHeight: 1.5 }}>{ex}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export default WordCard

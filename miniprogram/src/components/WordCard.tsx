import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

interface WordObj {
  name: string
  chinese?: string
  phonetic?: string
  examples?: string[]
}

interface WordCardProps {
  obj: WordObj
}

const WordCard: React.FC<WordCardProps> = ({ obj }) => {
  const [expanded, setExpanded] = useState(false)
  const { name, chinese, phonetic, examples } = obj

  const handleToggle = () => {
    setExpanded((prev) => !prev)
  }

  const handleSpeak = (e: any) => {
    e.stopPropagation()

    try {
      const audioCtx = Taro.createInnerAudioContext()
      console.log('[WordCard] TTS play requested for:', name, 'audioCtx:', audioCtx)
    } catch {
      console.log('[WordCard] TTS play requested for:', name)
    }
  }

  return (
    <View
      onClick={handleToggle}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e8e8e8',
        padding: '20px',
        marginBottom: '16px',
        textAlign: 'center',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      <View
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}
      >
        <Text
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1a1a1a',
            lineHeight: '1.4',
          }}
        >
          {name}
        </Text>

        <View
          onClick={handleSpeak}
          style={{
            fontSize: '22px',
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          🔊
        </View>
      </View>

      {chinese && (
        <Text
          style={{
            display: 'block',
            fontSize: '18px',
            color: '#e8642e',
            marginTop: '6px',
            lineHeight: '1.4',
          }}
        >
          {chinese}
        </Text>
      )}

      {phonetic && (
        <Text
          style={{
            display: 'block',
            fontSize: '14px',
            color: '#999999',
            marginTop: '4px',
            lineHeight: '1.4',
          }}
        >
          {phonetic}
        </Text>
      )}

      {examples && examples.length > 0 && (
        <View
          style={{
            marginTop: '6px',
            fontSize: '12px',
            color: '#bbbbbb',
          }}
        >
          <Text>{expanded ? '收起例句 ▲' : '展开例句 ▼'}</Text>
        </View>
      )}

      {expanded && examples && examples.length > 0 && (
        <View
          style={{
            marginTop: '14px',
            padding: '12px 16px',
            backgroundColor: '#f9f9fb',
            borderRadius: '10px',
            textAlign: 'left',
          }}
        >
          {examples.map((example, index) => (
            <View
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '8px 0',
                borderBottom:
                  index < examples.length - 1 ? '1px solid #eeeeee' : 'none',
              }}
            >
              <Text style={{ fontSize: '16px', flexShrink: 0 }}>📖</Text>
              <Text
                style={{
                  fontSize: '15px',
                  color: '#444444',
                  lineHeight: '1.6',
                }}
              >
                {example}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export default WordCard
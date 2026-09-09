import { detectLanguage } from '../lib/languageMap'

interface Props {
  filename: string
  size?: 'sm' | 'md'
}

export function LanguageBadge({ filename, size = 'sm' }: Props) {
  const info = detectLanguage(filename)
  if (!info) return null

  const textStyle = {
    backgroundColor: info.color + '22',
    color: info.color,
    borderColor: info.color + '44',
  }

  const cls = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold'
    : 'text-xs px-2 py-1 rounded border font-mono font-semibold'

  return (
    <span className={cls} style={textStyle}>
      {info.language}
    </span>
  )
}

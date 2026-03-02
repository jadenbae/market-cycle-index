interface Props {
  commentary: string
  date: string
}

export function Commentary({ commentary, date }: Props) {
  const paragraphs = commentary.split(/\n\n+/).filter(Boolean)
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Week of {date}</p>
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-gray-700 leading-relaxed">{p}</p>
        ))}
      </div>
    </div>
  )
}

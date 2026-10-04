import Markdown from 'react-markdown'

type Block = { kind: 'markdown'; body: string } | { kind: 'table'; rows: string[][] }

// The authored rulebook uses simple pipe tables. Render them as accessible HTML
// tables while leaving ordinary Markdown to the existing renderer.
function blocks(body: string): Block[] {
  const lines = body.replace(/^@\w+$/gm, '').split('\n')
  const result: Block[] = []
  let markdown: string[] = []
  const flush = () => {
    if (markdown.length) result.push({ kind: 'markdown', body: markdown.join('\n') })
    markdown = []
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|') && /^\|[\s:|\-]+\|$/.test(lines[i + 1] ?? '')) {
      flush()
      const rows = [lines[i]]
      i += 2
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++])
      i--
      result.push({
        kind: 'table',
        rows: rows.map((row) =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim()),
        ),
      })
    } else markdown.push(lines[i])
  }
  flush()
  return result
}

export function RuleText({ body }: { body: string }) {
  return (
    <div className="rule-text">
      {blocks(body).map((block, i) =>
        block.kind === 'markdown' ? (
          <Markdown key={i}>{block.body}</Markdown>
        ) : (
          <div className="table-wrap" key={i}>
            <table>
              <thead>
                <tr>
                  {block.rows[0].map((cell, j) => (
                    <th scope="col" key={j}>
                      <Markdown>{cell}</Markdown>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.slice(1).map((row, j) => (
                  <tr key={j}>
                    {row.map((cell, k) => (
                      <td key={k}>
                        <Markdown>{cell}</Markdown>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  )
}

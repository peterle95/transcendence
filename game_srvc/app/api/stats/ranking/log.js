function toText(value) {
  if (value === null || value === undefined) return '--'
  return String(value)
}

function pad(value, width, align = 'left') {
  const text = toText(value)
  if (text.length >= width) return text
  const spaces = ' '.repeat(width - text.length)
  return align === 'right' ? spaces + text : text + spaces
}

function hLine(widths) {
  return `+${widths.map((w) => '-'.repeat(w + 2)).join('+')}+`
}

function row(values, widths, aligns) {
  return `| ${values.map((v, i) => pad(v, widths[i], aligns[i])).join(' | ')} |`
}

function formatAccuracy(shotsHit, shotsFired) {
  if (!Number.isFinite(shotsFired) || shotsFired <= 0) return '--'
  if (!Number.isFinite(shotsHit)) return '--'
  return `${Math.round((shotsHit / shotsFired) * 100)}%`
}

function buildReportTable(users) {
  const headers = ['ID', 'Username', 'Wins', 'Losses', 'Points', 'Shots', 'Hit', 'Accuracy', 'Ships Lost', 'Ships Destroyed']
  const aligns = ['right', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right']

  const rows = users.map((u) => [
    u.id,
    u.username,
    u.wins,
    u.losses,
    u.points,
    u.shotsFired,
    u.shotsHit,
    formatAccuracy(u.shotsHit, u.shotsFired),
    u.shipsLost,
    u.shipsDestroyed,
  ])

  const widths = headers.map((h, i) => {
    const maxRowWidth = rows.reduce((acc, r) => Math.max(acc, toText(r[i]).length), 0)
    return Math.max(h.length, maxRowWidth)
  })

  const top = hLine(widths)
  const lines = [
    top,
    row(headers, widths, aligns),
    top,
    ...rows.map((r) => row(r, widths, aligns)),
    top,
  ]

  return lines.join('\n')
}

export async function logAuthUsersStatsSummary(meta = {}) {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth_srvc:3000'
  const token = process.env.AUTH_INTERNAL_API_TOKEN || process.env.SERVICE_SECRET

  try {
    const response = await fetch(`${authServiceUrl}/api/internal/stats/report`, {
      method: 'GET',
      headers: {
        ...(token ? { 'x-internal-token': token } : {}),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.warn('[stats/ranking] unable to print auth stats report:', response.status, errorBody)
      return
    }

    const payload = await response.json()
    const users = Array.isArray(payload?.users) ? payload.users : []

    const contextLine = `[RANKING] type=${meta.type || 'global'} | title=${meta.title || '--'} | returned=${meta.returned ?? '--'} | auth_users=${users.length}`
    const title = '[AUTH USERS STATS REPORT]'
    const stamp = new Date().toISOString()
    const border = '='.repeat(Math.max(title.length, contextLine.length, 40))

    console.log(`\n${border}\n${title}\n${contextLine}\nGenerated at: ${stamp}\n${border}`)

    if (!users.length) {
      console.log('No users found in auth service stats table.\n')
      return
    }

    console.log(buildReportTable(users))
    console.log('')
  } catch (error) {
    console.warn('[stats/ranking] unable to print auth stats report:', error)
  }
}
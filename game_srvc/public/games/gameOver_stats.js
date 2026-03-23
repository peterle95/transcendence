/**
 * gameOver_stats.js  –  Game Over overlay + global leaderboard
 *
 * Exposed globally:
 *   window.showRankingScreen(players, winner, gameMode, onClose)
 *
 * players  – Player[] from game.js  (each has .idx, .stats, .alive)
 * winner   – Player | null
 * gameMode – "solo" | "local2" | "local3" | "local4" | "remote"
 * onClose  – callback invoked when the player clicks "Back to Menu"
 */

(function () {
  /* ─── palette (matches game.js CFG.PLAYER_COLORS) ─── */
  const COLORS = ['#4488ff', '#44cc44', '#ff8800', '#ee3333'];
  const NAMES  = ['Blue',    'Green',   'Orange',  'Red'];

  const TABS = [
    { key: 'global',    label: '🏆 Wins'      },
    { key: 'sniper',    label: '🎯 Sniper'    },
    { key: 'destroyer', label: '💥 Destroyer' },
    { key: 'armored',   label: '🛡 Armored'   },
    { key: 'riddled',   label: '💀 Riddled'   },
    { key: 'spender',   label: '🔫 Spender'   },
  ];

  /* ─── helpers ─── */
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ─── save stats (best-effort, silently fails if not logged in) ─── */
  async function trySaveStats(players, winner, gameMode) {
    try {
      const payload = {
        sessionId: uuid(),
        gameMode,
        duration: 0,
        players: players.map((p, i) => ({
          slot:           p.idx,
          userId:         p.userId ?? 0,
          shotsFired:     p.stats.shotsFired,
          shotsHit:       p.stats.shotsHit,
          shipsLost:      p.stats.shipsLost,
          shipsDestroyed: p.stats.shipsDestroyed,
          isWinner:       winner ? p.idx === winner.idx : false,
          placement:      i + 1,
        })),
      };
      await fetch('/api/stats/save', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch (_) { /* silent */ }
  }

  /* ─── fetch a ranking tab ─── */
  async function fetchRanking(type) {
    const res  = await fetch(`/api/stats/ranking?type=${type}&limit=10`, {
      credentials: 'include',
    });
    const json = await res.json();
    return json.data ?? [];
  }

  /* ─── column definitions per tab ─── */
  function getColumns(type) {
    switch (type) {
      case 'sniper':    return [{ label: 'Accuracy',  field: 'accuracy'            }, { label: 'Shots', field: 'totalShotsFired' }];
      case 'destroyer': return [{ label: 'Destroyed', field: 'totalShipsDestroyed' }, { label: 'Games', field: 'totalGamesPlayed' }];
      case 'armored':   return [{ label: 'Lost',      field: 'totalShipsLost'      }, { label: 'Games', field: 'totalGamesPlayed' }];
      case 'riddled':   return [{ label: 'Lost',      field: 'totalShipsLost'      }, { label: 'Games', field: 'totalGamesPlayed' }];
      case 'spender':   return [{ label: 'Accuracy',  field: 'accuracy'            }, { label: 'Shots', field: 'totalShotsFired' }];
      default:          return [{ label: 'Wins',      field: 'totalWins'           }, { label: 'Win%',  field: 'winRate'         }];
    }
  }

  /* ─── build the overlay ─── */
  function buildOverlay(players, winner, onClose) {
    const overlay = document.createElement('div');
    overlay.id = 'ranking-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.93);
      display:flex; flex-direction:column; align-items:center;
      font-family:monospace; color:#fff;
      overflow-y:auto; padding:28px 16px;
    `;

    /* winner banner */
    const banner = document.createElement('div');
    banner.style.cssText = 'text-align:center; margin-bottom:20px;';
    if (winner) {
      const c = COLORS[winner.idx];
      banner.innerHTML = `
        <div style="font-size:2.4rem;font-weight:bold;color:${c};
                    text-shadow:0 0 24px ${c}88;letter-spacing:2px">
          ${NAMES[winner.idx].toUpperCase()} WINS!
        </div>`;
    } else {
      banner.innerHTML = `<div style="font-size:2rem;font-weight:bold">DRAW!</div>`;
    }
    overlay.appendChild(banner);

    /* per-player stat cards */
    const statsRow = document.createElement('div');
    statsRow.style.cssText = `
      display:flex; gap:14px; flex-wrap:wrap;
      justify-content:center; margin-bottom:26px;
    `;
    players.forEach(p => {
      const acc = p.stats.shotsFired > 0
        ? Math.round((p.stats.shotsHit / p.stats.shotsFired) * 100) + '%'
        : '--';
      const card = document.createElement('div');
      card.style.cssText = `
        border:2px solid ${COLORS[p.idx]}44;
        border-top:3px solid ${COLORS[p.idx]};
        border-radius:8px; padding:10px 18px;
        min-width:148px; text-align:center;
        background:${COLORS[p.idx]}0d;
      `;
      card.innerHTML = `
        <div style="color:${COLORS[p.idx]};font-weight:bold;margin-bottom:6px">
          ${NAMES[p.idx]}${winner && p.idx === winner.idx ? ' 🏆' : ''}
        </div>
        <div style="font-size:0.78rem;color:#ccc;line-height:1.8">
          Destroyed: <b style="color:#fff">${p.stats.shipsDestroyed}</b><br>
          Ships lost: <b style="color:#fff">${p.stats.shipsLost}</b><br>
          Accuracy:&nbsp;&nbsp;<b style="color:#fff">${acc}</b>
        </div>`;
      statsRow.appendChild(card);
    });
    overlay.appendChild(statsRow);

    /* leaderboard panel */
    const panel = document.createElement('div');
    panel.style.cssText = `
      width:100%; max-width:700px;
      border:1px solid #2a2a2a; border-radius:10px;
      overflow:hidden; margin-bottom:28px;
    `;

    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex; background:#111; border-bottom:1px solid #2a2a2a; overflow-x:auto;';

    const tableWrapper = document.createElement('div');
    tableWrapper.style.cssText = 'background:#090909; min-height:180px; padding:8px;';

    let activeTab = TABS[0].key;

    async function loadTab(key) {
      tableWrapper.innerHTML = '<div style="text-align:center;padding:32px;color:#444">Loading…</div>';
      let rows;
      try { rows = await fetchRanking(key); } catch (_) { rows = []; }

      if (!rows.length) {
        tableWrapper.innerHTML = '<div style="text-align:center;padding:32px;color:#444">No data yet – play some games!</div>';
        return;
      }
      const cols = getColumns(key);
      const medals = ['🥇', '🥈', '🥉'];
      let html = `
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
          <thead>
            <tr style="color:#555;border-bottom:1px solid #1e1e1e">
              <th style="padding:7px 6px;text-align:left;width:36px">#</th>
              <th style="padding:7px 6px;text-align:left">Player</th>
              ${cols.map(c => `<th style="padding:7px 6px;text-align:right">${c.label}</th>`).join('')}
            </tr>
          </thead><tbody>`;
      rows.forEach((r, i) => {
        const rankStr = medals[i] ?? r.rank;
        const gold = i === 0;
        html += `
          <tr style="border-bottom:1px solid #141414;${gold ? 'color:#ffd700' : ''}">
            <td style="padding:7px 6px">${rankStr}</td>
            <td style="padding:7px 6px">${r.username}</td>
            ${cols.map(c => `<td style="padding:7px 6px;text-align:right">${r[c.field]}</td>`).join('')}
          </tr>`;
      });
      html += '</tbody></table>';
      tableWrapper.innerHTML = html;
    }

    TABS.forEach(tab => {
      const btn = document.createElement('button');
      btn.textContent  = tab.label;
      btn.dataset.key  = tab.key;
      const active = () => tab.key === activeTab;
      const style  = () => {
        btn.style.color       = active() ? '#00d9ff' : '#555';
        btn.style.borderBottom = active() ? '2px solid #00d9ff' : '2px solid transparent';
      };
      btn.style.cssText = `
        flex:1; padding:9px 4px; background:none; border:none;
        font-family:monospace; font-size:0.72rem; cursor:pointer;
        white-space:nowrap;
      `;
      style();
      btn.onclick = () => {
        if (activeTab === tab.key) return;
        activeTab = tab.key;
        tabBar.querySelectorAll('button').forEach(b => {
          b.style.color       = b.dataset.key === activeTab ? '#00d9ff' : '#555';
          b.style.borderBottom = b.dataset.key === activeTab ? '2px solid #00d9ff' : '2px solid transparent';
        });
        loadTab(tab.key);
      };
      tabBar.appendChild(btn);
    });

    panel.appendChild(tabBar);
    panel.appendChild(tableWrapper);
    overlay.appendChild(panel);
    loadTab(activeTab);

    /* back to menu button */
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to Menu';
    backBtn.style.cssText = `
      padding:12px 44px; background:none;
      border:2px solid #00d9ff; border-radius:6px;
      color:#00d9ff; font-family:monospace; font-size:1rem;
      cursor:pointer;
    `;
    backBtn.onmouseenter = () => { backBtn.style.background = 'rgba(0,217,255,0.1)'; };
    backBtn.onmouseleave = () => { backBtn.style.background = 'none'; };
    backBtn.onclick = () => {
      overlay.remove();
      if (typeof onClose === 'function') onClose();
    };
    overlay.appendChild(backBtn);

    return overlay;
  }

  /* ─── public API ─── */
  window.showRankingScreen = function (players, winner, gameMode, onClose) {
    const old = document.getElementById('ranking-overlay');
    if (old) old.remove();
    const mode = gameMode || ('local' + players.length);
    trySaveStats(players, winner, mode);
    document.body.appendChild(buildOverlay(players, winner, onClose));
  };
})();
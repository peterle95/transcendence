(function () {
  function removeGlobalStatsOverlay() {
    const existing = document.getElementById('global-stats-overlay');
    if (existing) existing.remove();
  }

  function showGlobalStatsScreen(options = {}) {
    removeGlobalStatsOverlay();

    const onBack = typeof options.onBack === 'function' ? options.onBack : () => {};

    const overlay = document.createElement('div');
    overlay.id = 'global-stats-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0, 0, 0, 0.65)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1000';

    const panel = document.createElement('div');
    panel.style.width = 'min(760px, 92vw)';
    panel.style.padding = '28px 32px';
    panel.style.border = '2px solid #777';
    panel.style.background = 'rgba(8, 12, 34, 0.92)';
    panel.style.color = '#fff';
    panel.style.fontFamily = 'monospace';
    panel.style.textAlign = 'center';
    panel.style.maxHeight = '85vh';
    panel.style.overflowY = 'auto';

    const title = document.createElement('h2');
    title.textContent = 'GLOBAL STATISTICS';
    title.style.margin = '0 0 20px';
    title.style.fontSize = '32px';

    const tableWrapper = document.createElement('div');
    tableWrapper.style.minHeight = '120px';
    tableWrapper.innerHTML = '<div style="padding:32px;color:#555">Loading…</div>';

    // Fetch and render global ranking
    fetch('/api/stats/ranking?type=global&limit=10', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        const rows = json.data || [];
        if (!rows.length) {
          tableWrapper.innerHTML = '<div style="padding:32px;color:#666">No stats yet – play more games!</div>';
          return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        let html = `
          <table style="width:100%;border-collapse:collapse;font-size:0.82rem;text-align:left">
            <thead>
              <tr style="color:#888;border-bottom:1px solid #333">
                <th style="padding:7px 8px">#</th>
                <th style="padding:7px 8px">Player</th>
                <th style="padding:7px 8px;text-align:right">Wins</th>
                <th style="padding:7px 8px;text-align:right">Games</th>
                <th style="padding:7px 8px;text-align:right">Win%</th>
              </tr>
            </thead><tbody>`;
        rows.forEach((r, i) => {
          const gold = i === 0;
          html += `
            <tr style="border-bottom:1px solid #1a1a1a;${gold ? 'color:#ffd700' : ''}">
              <td style="padding:7px 8px">${medals[i] ?? r.rank}</td>
              <td style="padding:7px 8px">${r.username}</td>
              <td style="padding:7px 8px;text-align:right">${r.totalWins}</td>
              <td style="padding:7px 8px;text-align:right">${r.totalGamesPlayed}</td>
              <td style="padding:7px 8px;text-align:right">${r.winRate}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        tableWrapper.innerHTML = html;
      })
      .catch(() => {
        tableWrapper.innerHTML = '<div style="padding:32px;color:#666">Could not load stats.</div>';
      });

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = 'Back';
    backBtn.style.marginTop = '20px';
    backBtn.style.padding = '10px 20px';
    backBtn.style.fontFamily = 'monospace';
    backBtn.style.fontSize = '16px';
    backBtn.style.border = '1px solid #aaa';
    backBtn.style.background = '#111';
    backBtn.style.color = '#fff';
    backBtn.style.cursor = 'pointer';

    backBtn.addEventListener('click', () => {
      removeGlobalStatsOverlay();
      onBack();
    });

    panel.appendChild(title);
    panel.appendChild(tableWrapper);
    panel.appendChild(backBtn);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    return {
      close: removeGlobalStatsOverlay,
    };
  }

  window.showGlobalStatsScreen = showGlobalStatsScreen;
  window.hideGlobalStatsScreen = removeGlobalStatsOverlay;
})();

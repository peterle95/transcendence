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

    const title = document.createElement('h2');
    title.textContent = 'GLOBAL STATISTICS';
    title.style.margin = '0 0 12px';
    title.style.fontSize = '32px';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Placeholder screen. Database statistics from auth_srvc will be shown here.';
    subtitle.style.margin = '0 0 20px';
    subtitle.style.color = '#ccc';
    subtitle.style.fontSize = '15px';

    const placeholder = document.createElement('div');
    placeholder.style.border = '1px dashed #666';
    placeholder.style.padding = '20px';
    placeholder.style.marginBottom = '20px';
    placeholder.style.color = '#9ab';
    placeholder.textContent = 'No data yet.';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = 'Back';
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
    panel.appendChild(subtitle);
    panel.appendChild(placeholder);
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

(function () {
  function removeMenuOverlay() {
    const existing = document.getElementById('in-game-menu-overlay');
    if (existing) existing.remove();
  }

  function createButton(label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '  ' + label;
    btn.dataset.label = label;
    btn.style.width = '100%';
    btn.style.padding = '8px 12px';
    btn.style.fontFamily = 'monospace';
    btn.style.fontSize = '22px';
    btn.style.border = '0';
    btn.style.background = 'transparent';
    btn.style.color = '#ccc';
    btn.style.cursor = 'pointer';
    btn.style.textAlign = 'center';
    btn.style.outline = 'none';
    btn.style.boxShadow = 'none';
    btn.style.appearance = 'none';

    const onEnter = () => {
      btn.style.color = '#ffcc00';
      btn.textContent = '▸ ' + btn.dataset.label;
    };
    const onLeave = () => {
      btn.style.color = '#ccc';
      btn.textContent = '  ' + btn.dataset.label;
    };

    btn.addEventListener('mouseenter', onEnter);
    btn.addEventListener('focus', onEnter);
    btn.addEventListener('mouseleave', onLeave);
    btn.addEventListener('blur', onLeave);

    return btn;
  }

  function openInGameMenu(game) {
    removeMenuOverlay();
    game._isPausedByMenu = true;

    const overlay = document.createElement('div');
    overlay.id = 'in-game-menu-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0, 0, 0, 0.65)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '950';

    const panel = document.createElement('div');
    panel.style.width = 'min(760px, 92vw)';
    panel.style.padding = '32px 24px';
    panel.style.background = 'transparent';
    panel.style.color = '#fff';
    panel.style.fontFamily = 'monospace';
    panel.style.textAlign = 'center';

    const title = document.createElement('h2');
    title.textContent = 'SPACE FLEET BATTLE';
    title.style.margin = '0 0 10px';
    title.style.fontSize = '48px';
    title.style.fontWeight = '700';

    const subtitle = document.createElement('p');
    subtitle.style.margin = '0 0 30px';
    subtitle.style.color = '#aaa';
    subtitle.style.fontSize = '18px';

    const actions = document.createElement('div');
    actions.style.display = 'grid';
    actions.style.gap = '8px';
    actions.style.justifyItems = 'center';

    const keepPlayingBtn = createButton('Keep playing');
    const statsBtn = createButton('Statistics');
    const exitBtn = createButton('Exit Game');
    const menuButtons = [keepPlayingBtn, statsBtn, exitBtn];

    keepPlayingBtn.addEventListener('click', () => {
      removeMenuOverlay();
      game._isPausedByMenu = false;
    });

    statsBtn.addEventListener('click', () => {
      removeMenuOverlay();
      if (typeof window.showGlobalStatsScreen === 'function') {
        window.showGlobalStatsScreen({
          onBack: () => {
            openInGameMenu(game);
          },
        });
      }
    });

    exitBtn.addEventListener('click', () => {
      removeMenuOverlay();
      if (typeof window.hideGlobalStatsScreen === 'function') {
        window.hideGlobalStatsScreen();
      }
      if (typeof game.cancelCurrentSession === 'function') {
        game.cancelCurrentSession();
      }
    });

    actions.appendChild(keepPlayingBtn);
    actions.appendChild(statsBtn);
    actions.appendChild(exitBtn);

    panel.appendChild(title);
    panel.appendChild(subtitle);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let selectedIndex = 0;
    const focusByIndex = (index) => {
      selectedIndex = (index + menuButtons.length) % menuButtons.length;
      menuButtons[selectedIndex].focus();
    };

    overlay.tabIndex = -1;
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusByIndex(selectedIndex - 1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusByIndex(selectedIndex + 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        menuButtons[selectedIndex].click();
      }
    });

    menuButtons.forEach((btn, index) => {
      btn.addEventListener('focus', () => {
        selectedIndex = index;
      });
    });

    keepPlayingBtn.focus();
  }

  function attachInGameMenu(game) {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (!game || game.state !== 'playing') return;

      const overlay = document.getElementById('in-game-menu-overlay');
      const statsOverlay = document.getElementById('global-stats-overlay');

      if (statsOverlay) {
        return;
      }

      if (overlay) {
        removeMenuOverlay();
        game._isPausedByMenu = false;
      } else {
        openInGameMenu(game);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      removeMenuOverlay();
      document.removeEventListener('keydown', onKeyDown);
    };
  }

  window.attachInGameMenu = attachInGameMenu;
})();

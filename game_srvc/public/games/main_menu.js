(function () {
  class MainMenuController {
    constructor(game) {
      this.game = game;
      this.selection = 0;
      this.cooldown = 0;

      this.startY = 310;
      this.itemSpacing = 50;
      this.hitHalfWidth = 360;

      this.options = [
        { label: 'Solo (vs AI)', mode: 'solo' },
        { label: '2 Players (Local)', mode: 'local2' },
        { label: '3 Players (2 Local + 1 AI)', mode: 'local3' },
        { label: '4 Players (2 Local + 2 AI)', mode: 'local4' },
        // Multiplayer label text gets updated immediately before rendering
        { label: 'Multiplayer (Online)', mode: 'online' },
        { label: '← Back to Home', mode: 'home' },
      ];

      this._onMouseMove = this._handleMouseMove.bind(this);
      this._onClick = this._handleClick.bind(this);
      this._onMouseLeave = this._handleMouseLeave.bind(this);
    }

    attach() {
      const canvas = this.game.canvas;
      canvas.addEventListener('mousemove', this._onMouseMove);
      canvas.addEventListener('click', this._onClick);
      canvas.addEventListener('mouseleave', this._onMouseLeave);
    }

    detach() {
      const canvas = this.game.canvas;
      canvas.removeEventListener('mousemove', this._onMouseMove);
      canvas.removeEventListener('click', this._onClick);
      canvas.removeEventListener('mouseleave', this._onMouseLeave);
      canvas.style.cursor = 'default';
    }

    reset(cooldown = 0) {
      this.selection = 0;
      this.cooldown = cooldown;
    }

    setCooldown(cooldown) {
      this.cooldown = cooldown;
    }

    update(dt) {
      this.cooldown -= dt;
      if (this.cooldown > 0) return;

      if (this.game.input.isDown('ArrowUp')) {
        this.selection = (this.selection - 1 + this.options.length) % this.options.length;
        this.cooldown = 200;
      }
      if (this.game.input.isDown('ArrowDown')) {
        this.selection = (this.selection + 1) % this.options.length;
        this.cooldown = 200;
      }
      if (this.game.input.isDown('Enter') || this.game.input.isDown('Space')) {
        this.activateOption(this.selection);
      }
    }

    showRemoteMultiplayerUnavailableModal() {
      const existing = document.getElementById('remote-mp-unavailable-overlay');
      if (existing) return;

      const overlay = document.createElement('div');
      overlay.id = 'remote-mp-unavailable-overlay';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0, 0, 0, 0.8)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '1000';

      const panel = document.createElement('div');
      panel.style.background = '#1a1d36';
      panel.style.border = '2px solid #ff4400';
      panel.style.padding = '40px';
      panel.style.borderRadius = '16px';
      panel.style.maxWidth = '600px';
      panel.style.textAlign = 'center';
      panel.style.color = '#fff';
      panel.style.fontFamily = 'monospace';
      panel.style.boxShadow = '0 10px 40px rgba(255, 68, 0, 0.3)';

      const title = document.createElement('h2');
      title.textContent = 'MODE UNAVAILABLE';
      title.style.margin = '0 0 20px';
      title.style.color = '#ffaa00';
      title.style.fontSize = '32px';

      const desc = document.createElement('p');
      desc.textContent = 'Remote Multiplayer is disabled in this environment (local development). Use the local modes or test on production.';
      desc.style.fontSize = '18px';
      desc.style.lineHeight = '1.6';
      desc.style.color = '#ccc';
      desc.style.margin = '0 0 30px';

      const btn = document.createElement('button');
      btn.textContent = 'OK';
      btn.style.background = '#ff4400';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.padding = '12px 40px';
      btn.style.fontSize = '20px';
      btn.style.fontFamily = 'monospace';
      btn.style.fontWeight = 'bold';
      btn.style.borderRadius = '8px';
      btn.style.cursor = 'pointer';

      btn.addEventListener('click', () => {
        overlay.remove();
        this.cooldown = 300;
      });

      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
          overlay.remove();
          this.cooldown = 300;
        }
      });

      panel.appendChild(title);
      panel.appendChild(desc);
      panel.appendChild(btn);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      btn.focus();
    }

    activateOption(index) {
      const selectedOption = this.options[index];
      if (!selectedOption || selectedOption.mode === 'multiplayer') {
        this.cooldown = 300;
        return;
      }

      if (selectedOption.mode === 'online' && window.REMOTE_MULTIPLAYER_ENABLED === false) {
        this.showRemoteMultiplayerUnavailableModal();
        return;
      }

      if (selectedOption.mode === 'home') {
        // const homeUrl = window.location.protocol + '//' + window.location.hostname + ':3003';
        const homeUrl = '/';
        window.location.href = homeUrl;
        return;
      }

      this.game.selectedMode = selectedOption.mode;
      this.game._setupPlayers(this.game.selectedMode);
      this.game.state = 'playing';
      this.cooldown = 300;
    }

    draw() {
      const ctx = this.game.ctx;
      const width = this.game.canvas.width;
      const height = this.game.canvas.height;

      this.game._drawBackground();

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPACE FLEET BATTLE', width / 2, 180);

      ctx.font = '18px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Dominate space by destroying rival fleets!', width / 2, 220);

      ctx.font = '22px monospace';
      this.options.forEach((opt, i) => {
        const y = this.startY + i * this.itemSpacing;
        const selected = i === this.selection;
        let displayLabel = opt.label;
        if (opt.mode === 'online') {
            displayLabel = window.REMOTE_MULTIPLAYER_ENABLED === false
                ? 'Multiplayer (Not Available Locally)'
                : 'Multiplayer (Online)';
        }
        ctx.fillStyle = selected ? '#ffcc00' : '#ccc';
        ctx.fillText((selected ? '▸ ' : '  ') + displayLabel, width / 2, y);
      });

      ctx.font = '14px monospace';
      ctx.fillStyle = '#666';
      ctx.fillText('Mouse / ↑↓  Select   •   Enter / Space / Click  Start', width / 2, height - 60);
      ctx.fillText('P1: Arrows + Space   •   P2: WASD + Tab', width / 2, height - 35);
      ctx.textAlign = 'left';
    }

    _getPointerPosition(event) {
      const rect = this.game.canvas.getBoundingClientRect();
      const scaleX = this.game.canvas.width / rect.width;
      const scaleY = this.game.canvas.height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    }

    _getMenuIndexAtPosition(x, y) {
      const width = this.game.canvas.width;
      const minX = width / 2 - this.hitHalfWidth;
      const maxX = width / 2 + this.hitHalfWidth;
      if (x < minX || x > maxX) return -1;

      for (let i = 0; i < this.options.length; i++) {
        const itemY = this.startY + i * this.itemSpacing;
        if (y >= itemY - 24 && y <= itemY + 16) return i;
      }

      return -1;
    }

    _handleMouseMove(event) {
      if (this.game.state !== 'menu') {
        this.game.canvas.style.cursor = 'default';
        return;
      }

      const { x, y } = this._getPointerPosition(event);
      const index = this._getMenuIndexAtPosition(x, y);
      if (index >= 0) {
        this.selection = index;
        this.game.canvas.style.cursor = 'pointer';
      } else {
        this.game.canvas.style.cursor = 'default';
      }
    }

    _handleClick(event) {
      if (this.game.state !== 'menu' || this.cooldown > 0) return;

      const { x, y } = this._getPointerPosition(event);
      const index = this._getMenuIndexAtPosition(x, y);
      if (index >= 0) {
        this.selection = index;
        this.activateOption(index);
      }
    }

    _handleMouseLeave() {
      this.game.canvas.style.cursor = 'default';
    }
  }

  window.MainMenuController = MainMenuController;
})();

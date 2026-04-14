 #definizione della rete in PyTorch
"""
model.py — Rete neurale DQN con azioni Multi-Discrete
======================================================

Architettura:
  - Un trunk condiviso elabora lo stato del gioco
  - Tre teste indipendenti producono Q-values per ogni canale di azione

Canali di azione:
  movimento : 0=noop, 1=thrust, 2=reverse          → 3 valori
  rotazione : 0=noop, 1=sinistra, 2=destra         → 3 valori
  sparo     : 0=no,   1=sì                         → 2 valori

Combinazioni possibili: 3 × 3 × 2 = 18, con soli 8 output totali.
"""

import torch
import torch.nn as nn
import logging

log = logging.getLogger("model")


# ─── Descrizione dello spazio di azione ──────────────────────────────────────

ACTION_CHANNELS = {
    "movimento": 3,   # 0=noop, 1=thrust, 2=reverse
    "rotazione": 3,   # 0=noop, 1=rot_left, 2=rot_right
    "sparo":     2,   # 0=no,   1=sì
}
ACTION_LABELS = {
    "movimento": ["noop", "thrust", "reverse"],
    "rotazione": ["noop", "rot_left", "rot_right"],
    "sparo":     ["no_shoot", "shoot"],
}


# ─── Composizione del vettore di stato ───────────────────────────────────────
#
# Ogni gruppo di feature descrive una "categoria" di oggetti nel gioco.
# Gli oggetti vengono ordinati per distanza e si prendono i primi N.
# Se ce ne sono meno di N, le feature mancanti vengono riempite con 0 (padding).

N_ENEMIES = 1    # gioco 1v1, un solo nemico attivo
N_LASERS  = 3    # i 3 laser più vicini (nemici o propri)
N_METEORS = 3    # le 3 meteore più vicine

# Feature per categoria:
#
# La mia nave (8):
#   x/WIDTH, y/HEIGHT              → posizione normalizzata 0-1
#   sin(angle), cos(angle)         → orientamento (due valori perché l'angolo
#                                    è circolare: 0° e 360° sono uguali,
#                                    ma 0.0 e 1.0 non lo sono per la rete)
#   vx/MAX_SPEED, vy/MAX_SPEED     → velocità normalizzata
#   energy/MAX_ENERGY              → energia arma normalizzata 0-1
#   hp/MAX_HP                      → salute normalizzata 0-1
#
# Nemico (6) × N_ENEMIES:
#   dx/WIDTH, dy/HEIGHT            → posizione relativa normalizzata
#   dist/DIAGONAL                  → distanza normalizzata
#   sin(angle), cos(angle)         → orientamento del nemico
#   hp/MAX_HP                      → salute del nemico
#
# Laser (3) × N_LASERS:
#   dx/WIDTH, dy/HEIGHT            → posizione relativa normalizzata
#   is_enemy (0.0 o 1.0)           → laser nemico o mio?
#
# Meteora (3) × N_METEORS:
#   dx/WIDTH, dy/HEIGHT            → posizione relativa normalizzata
#   radius/MAX_RADIUS              → dimensione normalizzata

FEATURES_MY_SHIP = 8
FEATURES_ENEMY   = 6
FEATURES_LASER   = 3
FEATURES_METEOR  = 3

STATE_SIZE = (
    FEATURES_MY_SHIP +
    FEATURES_ENEMY  * N_ENEMIES +
    FEATURES_LASER  * N_LASERS  +
    FEATURES_METEOR * N_METEORS
)
# = 8 + 6×1 + 3×3 + 3×3 = 8 + 6 + 9 + 9 = 32


# ─── Rete neurale ─────────────────────────────────────────────────────────────

class DQNNetwork(nn.Module):
    """
    Rete DQN con architettura Multi-Discrete.

    Un trunk condiviso elabora lo stato e produce una rappresentazione interna.
    Tre teste separate leggono questa rappresentazione e producono
    Q-values indipendenti per movimento, rotazione e sparo.
    """

    TRUNK_HIDDEN = 256
    HEAD_HIDDEN  = 64

    def __init__(
        self,
        state_size:      int  = STATE_SIZE,
        action_channels: dict = ACTION_CHANNELS,
    ):
        super().__init__()
        self.state_size      = state_size
        self.action_channels = action_channels

        # ── Trunk condiviso ───────────────────────────────────────────────
        self.trunk = nn.Sequential(
            nn.Linear(state_size, self.TRUNK_HIDDEN),
            nn.ReLU(),
            nn.Linear(self.TRUNK_HIDDEN, self.TRUNK_HIDDEN),
            nn.ReLU(),
            nn.Linear(self.TRUNK_HIDDEN, self.TRUNK_HIDDEN // 2),
            nn.ReLU(),
        )
        trunk_out = self.TRUNK_HIDDEN // 2  # 128

        # ── Teste indipendenti ────────────────────────────────────────────
        # nn.ModuleDict registra le teste come sotto-moduli ufficiali
        # così i loro parametri sono inclusi in model.parameters()
        self.heads = nn.ModuleDict({
            name: nn.Sequential(
                nn.Linear(trunk_out, self.HEAD_HIDDEN),
                nn.ReLU(),
                nn.Linear(self.HEAD_HIDDEN, n_actions),
            )
            for name, n_actions in action_channels.items()
        })

        self._init_weights()

    def _init_weights(self):
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.kaiming_uniform_(module.weight, nonlinearity='relu')
                nn.init.zeros_(module.bias)

    def forward(self, state: torch.Tensor) -> dict[str, torch.Tensor]:
        """
        Passaggio in avanti.

        Parametri
        ---------
        state : Tensor (batch_size, STATE_SIZE)

        Restituisce
        -----------
        {
          "movimento": Tensor (batch_size, 3),
          "rotazione": Tensor (batch_size, 3),
          "sparo":     Tensor (batch_size, 2),
        }
        """
        shared = self.trunk(state)
        return {name: head(shared) for name, head in self.heads.items()}

    def get_action(self, state: torch.Tensor) -> dict[str, int]:
        """
        Azione greedy dato uno stato. Usato durante il gioco, non il training.

        Restituisce
        -----------
        {"movimento": 1, "rotazione": 0, "sparo": 1}
        → thrust, nessuna rotazione, spara
        """
        with torch.no_grad():
            if state.dim() == 1:
                state = state.unsqueeze(0)
            q_values = self.forward(state)
            return {
                name: q.argmax(dim=1).item()
                for name, q in q_values.items()
            }

    def get_action_labels(self, state: torch.Tensor) -> dict[str, str]:
        """Come get_action ma con etichette leggibili. Utile per debug."""
        action_indices = self.get_action(state)
        return {
            name: ACTION_LABELS[name][idx]
            for name, idx in action_indices.items()
        }


# ─── Target Network ───────────────────────────────────────────────────────────

class DQNTargetNetwork(DQNNetwork):
    """
    Copia della rete principale con pesi aggiornati ogni N step.
    Fornisce un bersaglio stabile per il calcolo dell'errore durante il training.
    """

    def update_from(self, source: "DQNNetwork"):
        self.load_state_dict(source.state_dict())


# ─── Funzioni di utilità ──────────────────────────────────────────────────────

def build_model_pair(
    state_size:      int  = STATE_SIZE,
    action_channels: dict = ACTION_CHANNELS,
    device:          str  = "cpu",
) -> tuple["DQNNetwork", "DQNTargetNetwork"]:
    """Crea la coppia (rete_principale, rete_target) pronta per il training."""
    online = DQNNetwork(state_size, action_channels).to(device)
    target = DQNTargetNetwork(state_size, action_channels).to(device)
    target.update_from(online)
    for param in target.parameters():
        param.requires_grad = False
    return online, target


def save_model(network: DQNNetwork, path: str, metadata: dict | None = None):
    payload = {
        "state_dict":      network.state_dict(),
        "state_size":      network.state_size,
        "action_channels": network.action_channels,
    }
    if metadata:
        payload["metadata"] = metadata

    torch.save(payload, path)
    if metadata:
        log.info("model saved -> %s metadata=%s", path, metadata)
    else:
        log.info("model saved -> %s", path)


def load_model(path: str, device: str = "cpu") -> DQNNetwork:
    checkpoint = torch.load(path, map_location=device)
    net = DQNNetwork(
        state_size=checkpoint["state_size"],
        action_channels=checkpoint["action_channels"],
    ).to(device)
    net.load_state_dict(checkpoint["state_dict"])
    net.eval()
    metadata = checkpoint.get("metadata")
    if metadata:
        log.info("model loaded <- %s metadata=%s", path, metadata)
    else:
        log.info("model loaded <- %s", path)
    return net


# ─── Test rapido ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== Test model.py ===\n")

    online, target = build_model_pair()

    print(f"STATE_SIZE  : {STATE_SIZE}")
    print(f"  my ship   : {FEATURES_MY_SHIP}")
    print(f"  enemies   : {FEATURES_ENEMY} x {N_ENEMIES} = {FEATURES_ENEMY * N_ENEMIES}")
    print(f"  lasers    : {FEATURES_LASER} x {N_LASERS}  = {FEATURES_LASER * N_LASERS}")
    print(f"  meteors   : {FEATURES_METEOR} x {N_METEORS}  = {FEATURES_METEOR * N_METEORS}")
    print()

    fake_batch = torch.rand(32, STATE_SIZE)
    q_values = online(fake_batch)
    for name, q in q_values.items():
        print(f"Output '{name}': shape={q.shape}  esempio={q[0].detach().numpy().round(3)}")
    print()

    single_state = torch.rand(STATE_SIZE)
    print(f"Azione (indici) : {online.get_action(single_state)}")
    print(f"Azione (labels) : {online.get_action_labels(single_state)}")
    print()

    total_params = sum(p.numel() for p in online.parameters())
    combos = 1
    for n in ACTION_CHANNELS.values():
        combos *= n
    print(f"Parametri totali    : {total_params:,}")
    print(f"Combinazioni azioni : {' × '.join(str(n) for n in ACTION_CHANNELS.values())} = {combos}")
    print("\n=== OK ===")
from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

EVENT_RE = re.compile(
    r"^\|\s*UTC Time:\s*(?P<utc>[^|]+?)\s*\|\s*Event:\s*(?P<event>[^|]+?)\s*\|\s*"
    r"Episodes:\s*session=(?P<session_episodes>\d+);\s*total=(?P<total_episodes>\d+)\s*\|\s*"
    r"Transitions:\s*session=(?P<session_transitions>\d+);\s*total=(?P<total_transitions>\d+)\s*\|\s*"
    r"(?:"
    r"Epsilon:\s*(?P<epsilon>[-+]?\d*\.?\d+)\s*\|\s*"
    r"|"
    r"Epsilon\s+Start:\s*(?P<epsilon_start>[-+]?\d*\.?\d+)\s*\|\s*"
    r"Epsilon\s+End:\s*(?P<epsilon_end>[-+]?\d*\.?\d+)\s*\|\s*"
    r")"
    r"Replay:\s*(?P<replay>\d+)\s*\|\s*"
    r"Avg Reward:\s*(?P<avg_reward>[-+]?\d*\.?\d+)\s*\|\s*"
    r"Avg Loss:\s*(?P<avg_loss>[-+]?\d*\.?\d+)\s*\|\s*"
    r"Win Rate\s*\((?P<window>\d+)\s*ep\):\s*(?P<win_rate_pct>[-+]?\d*\.?\d+)%\s*\|\s*"
    r"Runtime Config Updates:\s*(?P<updates>.*?)\s*\|\s*$"
)


def _parse_dt(value: str) -> Optional[datetime]:
    value = value.strip()
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def parse_log(log_path: Path) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    lines = log_path.read_text(encoding="utf-8").splitlines()

    sessions: List[Dict[str, Any]] = []
    current_session: Optional[Dict[str, Any]] = None
    in_env_table = False

    events: List[Dict[str, Any]] = []

    for idx, raw in enumerate(lines, start=1):
        line = raw.rstrip("\n")

        if line.startswith("## New Training Session"):
            if current_session is not None:
                sessions.append(current_session)
            current_session = {
                "line": idx,
                "utc": None,
                "start_dt": None,
                "env": {},
            }
            in_env_table = False
            continue

        if current_session is not None and line.startswith("- UTC Time:") and current_session["utc"] is None:
            utc = line.split(":", 1)[1].strip()
            current_session["utc"] = utc
            current_session["start_dt"] = _parse_dt(utc)
            continue

        if line.strip() == "| ENV | Value |":
            in_env_table = True
            continue

        if in_env_table:
            if line.startswith("| ---"):
                continue
            if not line.startswith("|"):
                in_env_table = False
            else:
                if current_session is None:
                    continue
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 4 and parts[1] and parts[2]:
                    current_session["env"][parts[1]] = parts[2]
                continue

        m = EVENT_RE.match(line)
        if not m:
            continue

        gd = m.groupdict()
        dt = _parse_dt(gd["utc"])
        if dt is None:
            continue

        events.append(
            {
                "line": idx,
                "dt": dt,
                "ts": dt.isoformat(),
                "event": gd["event"].strip(),
                "session_episodes": int(gd["session_episodes"]),
                "total_episodes": int(gd["total_episodes"]),
                "session_transitions": int(gd["session_transitions"]),
                "total_transitions": int(gd["total_transitions"]),
                "epsilon": float(gd["epsilon"]) if gd.get("epsilon") is not None else float(gd.get("epsilon_end") or 0.0),
                "replay": int(gd["replay"]),
                "avg_reward": float(gd["avg_reward"]),
                "avg_loss": float(gd["avg_loss"]),
                "win_rate_pct": float(gd["win_rate_pct"]),
            }
        )

    if current_session is not None:
        sessions.append(current_session)

    sessions.sort(key=lambda s: s.get("start_dt") or datetime.min)
    events.sort(key=lambda e: e["dt"])

    return sessions, events


def attach_mode(sessions: List[Dict[str, Any]], events: List[Dict[str, Any]]) -> None:
    sessions_sorted = [s for s in sessions if s.get("start_dt") is not None]
    sessions_sorted.sort(key=lambda s: s["start_dt"])

    s_idx = 0
    active_mode = "unknown"
    active_line = None

    for e in events:
        while s_idx < len(sessions_sorted) and sessions_sorted[s_idx]["start_dt"] <= e["dt"]:
            active_mode = sessions_sorted[s_idx]["env"].get("TRAINING_SCENARIO", "unknown")
            active_line = sessions_sorted[s_idx]["line"]
            s_idx += 1
        e["mode"] = active_mode
        e["session_header_line"] = active_line



def build_chart_payload(sessions: List[Dict[str, Any]], events: List[Dict[str, Any]], log_name: str) -> Dict[str, Any]:
    scenario_order = ["meteor-only", "combat", "baseline"]

    by_mode: Dict[str, Dict[str, Any]] = {
        mode: {
            "x": [],
            "win_rate_pct": [],
            "avg_reward": [],
            "avg_loss": [],
            "sessions": [],
        }
        for mode in scenario_order
    }

    for e in events:
        mode = e.get("mode", "unknown")
        if mode not in by_mode:
            continue
        by_mode[mode]["x"].append(e["ts"])
        by_mode[mode]["win_rate_pct"].append(e["win_rate_pct"])
        by_mode[mode]["avg_reward"].append(e["avg_reward"])
        by_mode[mode]["avg_loss"].append(e["avg_loss"])

    session_rows = []
    for s in sessions:
        start = s.get("start_dt")
        if start is None:
            continue
        mode = s.get("env", {}).get("TRAINING_SCENARIO", "unknown")
        line = s.get("line")
        link = f"{log_name}#L{line}"

        session_rows.append(
            {
                "time": start.isoformat(),
                "mode": mode,
                "line": line,
                "link": link,
            }
        )

        if mode in by_mode:
            by_mode[mode]["sessions"].append(
                {
                    "x": start.isoformat(),
                    "y": 0,
                    "mode": mode,
                    "line": line,
                    "link": link,
                }
            )

    return {
        "scenario_order": scenario_order,
        "by_mode": by_mode,
        "session_rows": session_rows,
    }


def render_html(payload: Dict[str, Any], output_path: Path, log_name: str) -> None:
    scenario_order = payload["scenario_order"]
    by_mode = payload["by_mode"]
    session_rows = payload["session_rows"]

    session_table_rows = "\n".join(
        f"<tr><td>{idx + 1}</td><td>{row['time']}</td><td>{row['mode']}</td>"
        f"<td><a href=\"{row['link']}\" target=\"_blank\">line {row['line']}</a></td></tr>"
        for idx, row in enumerate(session_rows)
    )

    html = f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>AI Training Dashboard</title>
  <script src=\"https://cdn.plot.ly/plotly-2.35.2.min.js\"></script>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f6f8fb; color: #111; }}
    .wrap {{ max-width: 1200px; margin: 0 auto; padding: 20px; }}
    .card {{ background: #fff; border: 1px solid #e6eaf0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }}
    h1 {{ margin: 0 0 8px; font-size: 24px; }}
    p {{ margin: 0 0 10px; color: #444; }}
    #chart {{ width: 100%; height: 620px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }}
    th, td {{ border: 1px solid #e6eaf0; padding: 8px; text-align: left; }}
    th {{ background: #f3f6fb; }}
    .hint {{ font-size: 13px; color: #666; margin-top: 8px; }}
  </style>
</head>
<body>
  <div class=\"wrap\">
    <div class=\"card\">
            <h1>Training Timeline Dashboard</h1>
            <p>Y-axis recommendation: keep <strong>Win Rate (%)</strong> as primary KPI. Use Avg Reward and Avg Loss as diagnostics.</p>
            <label style="display:flex; align-items:center; gap:8px; margin: 8px 0 16px;">
                <input id="toggle-secondary" type="checkbox" checked />
                Mostra curve asse Y secondario (Avg Reward, Avg Loss)
            </label>

            <h2>Meteor-Only</h2>
            <div id="chart-meteor-only" style="width: 100%; height: 420px;"></div>
            <h2>Combat</h2>
            <div id="chart-combat" style="width: 100%; height: 420px;"></div>
            <h2>Baseline</h2>
            <div id="chart-baseline" style="width: 100%; height: 420px;"></div>
            <p class="hint">Click a Session Start marker to open the related "## New Training Session" line in {log_name}.</p>
      <h2>Training Sessions</h2>
      <table>
        <thead><tr><th>#</th><th>UTC Time</th><th>Mode</th><th>Header Link</th></tr></thead>
        <tbody>
          {session_table_rows}
        </tbody>
      </table>
    </div>
  </div>

  <script>
        const scenarioOrder = {json.dumps(scenario_order)};
        const byMode = {json.dumps(by_mode)};

        const modeColors = {{
            "meteor-only": "#1f77b4",
            "combat": "#d62728",
            "baseline": "#2ca02c"
        }};

        function buildTraces(mode) {{
            const data = byMode[mode] || {{x: [], win_rate_pct: [], avg_reward: [], avg_loss: [], sessions: []}};

            return [
                {{
                    x: data.x,
                    y: data.win_rate_pct,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: 'Win Rate (%)',
                    line: {{ color: modeColors[mode] || '#555', width: 2 }},
                    marker: {{ size: 4 }}
                }},
                {{
                    x: data.x,
                    y: data.avg_reward,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Avg Reward',
                    yaxis: 'y2',
                    line: {{ color: '#9467bd', width: 1.5, dash: 'dot' }}
                }},
                {{
                    x: data.x,
                    y: data.avg_loss,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Avg Loss',
                    yaxis: 'y2',
                    line: {{ color: '#ff7f0e', width: 1.5, dash: 'dash' }}
                }},
                {{
                    x: data.sessions.map(s => s.x),
                    y: data.sessions.map(_ => 0),
                    type: 'scatter',
                    mode: 'markers',
                    name: 'Session Starts',
                    marker: {{ symbol: 'diamond', size: 8, color: '#111111' }},
                    customdata: data.sessions,
                    hovertemplate: 'Session Start<br>Time: %{{x}}<br>Line: %{{customdata.line}}<extra></extra>'
                }}
            ];
        }}

        function buildLayout(mode) {{
            return {{
                title: mode,
                xaxis: {{ title: 'UTC Timeline', type: 'date', gridcolor: 'rgba(0,0,0,0.08)' }},
                yaxis: {{ title: 'Win Rate (%)', zeroline: true, gridcolor: 'rgba(0,0,0,0.08)' }},
                yaxis2: {{ title: 'Avg Reward / Avg Loss', overlaying: 'y', side: 'right', showgrid: false }},
                legend: {{ orientation: 'h', y: -0.2 }},
                margin: {{ t: 50, r: 70, b: 70, l: 60 }},
                plot_bgcolor: '#ffffff',
                paper_bgcolor: '#ffffff'
            }};
        }}

        const chartIds = scenarioOrder.map((mode) => `chart-${{mode}}`);

        function applySecondaryVisibility(show) {{
            chartIds.forEach((chartId) => {{
                Plotly.restyle(chartId, {{ visible: show }}, [1, 2]);
                Plotly.relayout(chartId, {{
                    'yaxis2.showticklabels': show,
                    'yaxis2.showgrid': false,
                    'yaxis2.title': show ? 'Avg Reward / Avg Loss' : ''
                }});
            }});
        }}

        scenarioOrder.forEach((mode) => {{
            const chartId = `chart-${{mode}}`;
            const traces = buildTraces(mode);
            const layout = buildLayout(mode);
            Plotly.newPlot(chartId, traces, layout, {{ responsive: true }}).then((plot) => {{
                plot.on('plotly_click', (ev) => {{
                    if (!ev || !ev.points || !ev.points.length) return;
                    const p = ev.points[0];
                    if (!p.customdata || !p.customdata.link) return;
                    window.open(p.customdata.link, '_blank');
                }});
            }});
        }});

        const secondaryToggle = document.getElementById('toggle-secondary');
        if (secondaryToggle) {{
            secondaryToggle.addEventListener('change', () => applySecondaryVisibility(secondaryToggle.checked));
        }}
  </script>
</body>
</html>
"""

    output_path.write_text(html, encoding="utf-8")


def generate_dashboard(log_path: Path, out_path: Path) -> tuple[int, int]:
    sessions, events = parse_log(log_path)
    attach_mode(sessions, events)
    payload = build_chart_payload(sessions, events, log_path.name)
    render_html(payload, out_path, log_path.name)
    return len(payload["session_rows"]), len(events)


def _appended_contains_checkpoint(path: Path, last_size: int) -> tuple[bool, int]:
    current_size = path.stat().st_size
    if current_size == last_size:
        return False, last_size

    # Log rotation/truncation: restart scan from beginning.
    start_pos = last_size if current_size >= last_size else 0
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        f.seek(start_pos)
        appended = f.read()

    return "| Event: checkpoint |" in appended, current_size


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate interactive training dashboard from AI_Training_Log.md")
    parser.add_argument(
        "--log",
        default="AI_Training_Log.md",
        help="Path to training log markdown file",
    )
    parser.add_argument(
        "--out",
        default="training_dashboard.html",
        help="Output HTML path",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Keep watching the log file and regenerate dashboard only when a checkpoint event is appended",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=5.0,
        help="Polling interval in seconds for --watch mode (default: 5.0)",
    )
    args = parser.parse_args()

    log_path = Path(args.log).resolve()
    out_path = Path(args.out).resolve()
    poll_interval = max(0.5, float(args.interval))

    parsed_sessions, parsed_events = generate_dashboard(log_path, out_path)
    print(f"Dashboard generated: {out_path}")
    print(f"Parsed sessions: {parsed_sessions}")
    print(f"Parsed events: {parsed_events}")

    if not args.watch:
        return

    print(f"Watch mode enabled (interval: {poll_interval:.1f}s). Refresh triggers only on new checkpoint events. Press Ctrl+C to stop.")
    last_size = log_path.stat().st_size

    try:
        while True:
            time.sleep(poll_interval)
            has_checkpoint, last_size = _appended_contains_checkpoint(log_path, last_size)
            if not has_checkpoint:
                continue

            parsed_sessions, parsed_events = generate_dashboard(log_path, out_path)
            now = datetime.now().isoformat(timespec="seconds")
            print(
                f"[{now}] Dashboard refreshed: {out_path} | "
                f"sessions={parsed_sessions} events={parsed_events}"
            )
    except KeyboardInterrupt:
        print("Watch mode stopped.")


if __name__ == "__main__":
    main()

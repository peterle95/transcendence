/**
 * Training Scenarios — Configuration presets for AI training environments
 *
 * Each scenario defines game parameters tailored to specific training objectives:
 * - meteor-only: Pure spatial navigation task (avoid projectiles, no combat)
 * - combat: 1v1 combat without distractions (no meteors)
 * - baseline: Full game (1v1 + meteors, mirroring player experience)
 *
 * All scenarios are hidden from the normal game UI and accessible only via
 * TRAINING_SCENARIO environment variable during training runs.
 */

const SCENARIOS = Object.freeze({
  'baseline': {
    name: 'Baseline — 1v1 + Meteors (Full Game)',
    description: 'Full game: 1vs1 combat with meteors. Trains complete skill set.',
    meteorCount: 8,
    meteorSpawning: true,
    meteorSpeed: 1.0,
    enemyCount: 1,
    enableEnemyAI: true,
    enemySpawning: true,
    episodeTimeout: 120000, // ms
  },

  'combat': {
    name: 'Combat — 1v1 No Meteors',
    description: 'Pure 1vs1 dueling: enemy combat AI only, zero environmental hazards.',
    meteorCount: 0,
    meteorSpawning: false,
    meteorSpeed: 1.0,
    enemyCount: 1,
    enableEnemyAI: true,
    enemySpawning: true,
    episodeTimeout: 120000, // ms
  },

  'meteor-only': {
    name: 'Navigation — Meteors Only (No Combat)',
    description: 'Pure spatial navigation: dense meteor field, no opponent.',
    meteorCount: 16,
    meteorSpawning: true,
    meteorSpeed: 1.2,
    enemyCount: 0,
    enableEnemyAI: false,
    enemySpawning: false,
    episodeTimeout: 120000, // ms
  },
});

/**
 * Get scenario config by name. Falls back to 'baseline' if not found.
 * @param {string} scenarioName - Scenario key (e.g., 'baseline', 'combat', 'meteor-only')
 * @returns {object} Scenario configuration object
 */
function getScenario(scenarioName = 'baseline') {
  return SCENARIOS[scenarioName] || SCENARIOS['baseline'];
}

/**
 * List all available scenario names.
 * @returns {string[]} Array of scenario keys
 */
function listScenarios() {
  return Object.keys(SCENARIOS);
}

module.exports = {
  SCENARIOS,
  getScenario,
  listScenarios,
};

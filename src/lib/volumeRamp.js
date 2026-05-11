/**
 * Volume Ramp Calculation Engine
 * Berechnet die Ziel-Lautstärke basierend auf Zeit und Rampenverlauf
 */

/**
 * Berechne die aktuelle Ziel-Lautstärke für einen Zeitblock
 * @param {Object} block - Der Zeitblock mit Rampenkonfiguration
 * @param {Date} currentTime - Aktuelle Zeit (default: jetzt)
 * @returns {Object} { targetVolume, progress, nextStep, mode }
 */
export function calculateTargetVolume(block, currentTime = new Date()) {
  // Wenn Rampe deaktiviert
  if (!block.volumeRampEnabled) {
    return {
      targetVolume: block.baseVolume,
      progress: 0,
      isRamped: false,
      nextStep: null,
    };
  }

  // Parse Zeiten
  const [startHour, startMin] = block.startTime.split(':').map(Number);
  const [endHour, endMin] = block.endTime.split(':').map(Number);

  const blockStart = new Date(currentTime);
  blockStart.setHours(startHour, startMin, 0, 0);

  const blockEnd = new Date(currentTime);
  blockEnd.setHours(endHour, endMin, 0, 0);

  // Prüfe ob Block aktiv ist
  if (currentTime < blockStart || currentTime > blockEnd) {
    return {
      targetVolume: block.baseVolume,
      progress: 0,
      isActive: false,
      isRamped: true,
    };
  }

  // Berechne Progress (0-1)
  const totalDuration = blockEnd - blockStart;
  const elapsedDuration = currentTime - blockStart;
  const progress = elapsedDuration / totalDuration;

  // Berechne Ziel-Lautstärke
  const volumeDiff = block.endVolume - block.startVolume;
  const targetVolume = block.startVolume + progress * volumeDiff;

  // Berechne nächsten Schritt
  const nextStep = calculateNextStep(block, currentTime, blockStart, blockEnd);

  return {
    targetVolume: Math.round(targetVolume),
    progress: Math.min(1, progress),
    isActive: true,
    isRamped: true,
    nextStep,
    mode: block.rampMode,
  };
}

/**
 * Berechne den nächsten Rampenschritt
 */
function calculateNextStep(block, currentTime, blockStart, blockEnd) {
  const mode = block.rampMode;
  let nextStepTime;

  switch (mode) {
    case 'hourly': {
      const nextHour = new Date(currentTime);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      nextStepTime = nextHour;
      break;
    }
    case 'every_30_min': {
      const nextMin = new Date(currentTime);
      const mins = nextMin.getMinutes();
      const nextRound = mins < 30 ? 30 : 60;
      nextMin.setMinutes(nextRound, 0, 0);
      nextStepTime = nextMin;
      break;
    }
    case 'every_15_min': {
      const nextMin = new Date(currentTime);
      const mins = nextMin.getMinutes();
      const slots = [0, 15, 30, 45];
      const nextSlot = slots.find(s => s > mins) || 0;
      if (nextSlot === 0) nextMin.setHours(nextMin.getHours() + 1);
      nextMin.setMinutes(nextSlot, 0, 0);
      nextStepTime = nextMin;
      break;
    }
    case 'continuous':
    default:
      return null;
  }

  if (nextStepTime > blockEnd) {
    return null;
  }

  const nextProgress = (nextStepTime - blockStart) / (blockEnd - blockStart);
  const volumeDiff = block.endVolume - block.startVolume;
  const nextVolume = block.startVolume + nextProgress * volumeDiff;

  return {
    time: nextStepTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    volume: Math.round(nextVolume),
  };
}

/**
 * Test Funktion für Rampenverlauf
 * Zeigt Lautstärke zu bestimmten Zeitpunkten
 */
export function testRampCalculation(block, testHour) {
  const testTime = new Date();
  testTime.setHours(testHour, 0, 0, 0);

  const result = calculateTargetVolume(block, testTime);

  return {
    testTime: testTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    ...result,
  };
}

/**
 * Generiere einen Rampen-Verlauf für Anzeige
 * Zeigt die Lautstärke über den Tag verteilt
 */
export function generateRampPreview(block) {
  const [startHour] = block.startTime.split(':').map(Number);
  const [endHour] = block.endTime.split(':').map(Number);

  const points = [];

  for (let h = startHour; h <= endHour; h++) {
    const testTime = new Date();
    testTime.setHours(h, 0, 0, 0);
    const result = calculateTargetVolume(block, testTime);

    points.push({
      time: `${String(h).padStart(2, '0')}:00`,
      volume: result.targetVolume,
    });
  }

  return points;
}
/** Parse event.teamSize strings like "1", "2-4", "3" into participation limits. */
const parseTeamSizeLimits = (teamSizeRaw) => {
  const raw = teamSizeRaw == null ? '' : String(teamSizeRaw).trim();
  if (!raw || raw === '1') {
    return { min: 1, max: 1, isIndividual: true };
  }
  const nums = raw.match(/\d+/g);
  if (!nums || nums.length === 0) {
    return { min: 1, max: 5, isIndividual: false };
  }
  const values = nums.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) {
    return { min: 1, max: 5, isIndividual: false };
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  return { min, max, isIndividual: max <= 1 };
};

module.exports = { parseTeamSizeLimits };

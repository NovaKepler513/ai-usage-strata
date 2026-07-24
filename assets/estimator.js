(() => {
  const sum = (items, field) => items.reduce((total, item) => total + (Number(item[field]) || 0), 0);

  const estimateFor = (days, calibration) => {
    const active = days.filter((item) => Number(item.commits) > 0);
    const activeDays = active.length;
    const commits = sum(days, "commits");
    const semantic = sum(days, "semantic");
    const measuredHours = sum(days, "measured_hours");
    const loggedInput = sum(days, "input_chars");
    const loggedOutput = sum(days, "output_chars");
    const averageCommits = activeDays ? commits / activeDays : 0;
    const activityFactor = averageCommits
      ? Math.min(1.6, Math.max(0.65, Math.sqrt(averageCommits / calibration.commits_per_active_day)))
      : 0;
    const range = (rates, measured) => activeDays
      ? [
          Math.max(activeDays * rates[0] * activityFactor, measured),
          Math.max(activeDays * rates[1] * activityFactor, measured)
        ]
      : [measured, measured];
    const timeRange = range(calibration.hours_per_active_day, measuredHours);
    const inputRange = range(calibration.input_chars_per_active_day, loggedInput);
    const outputRange = range(calibration.output_chars_per_active_day, loggedOutput);
    const visibleDays = days.filter((item) => item.measured_hours || item.input_chars || item.output_chars).length;
    return {
      commits,
      semantic,
      activeDays,
      visibleDays,
      measuredHours,
      loggedInput,
      loggedOutput,
      averageCommits,
      activityFactor,
      timeRange,
      inputRange,
      outputRange,
      hoursCenter: (timeRange[0] + timeRange[1]) / 2,
      inputCenter: (inputRange[0] + inputRange[1]) / 2,
      outputCenter: (outputRange[0] + outputRange[1]) / 2,
      coverage: activeDays ? Math.min(1, visibleDays / activeDays) : (visibleDays ? 1 : 0)
    };
  };

  window.AI_USAGE_STRATA_ESTIMATOR = Object.freeze({ estimateFor });
})();

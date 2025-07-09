// --- General ---

function splitLines(string) {
  return string.split("\n");
}

function getLineIsFromTable(line) {
  return /\|.+\|/.test(line);
}

function getLineIndexOfLastEntry(issueBodyLines) {
  let timeLogHeadingFound = false;
  return issueBodyLines.findIndex((line, lineIndex) => {
    if (!timeLogHeadingFound) {
      if (line === "## Time log") {
        timeLogHeadingFound = true;
      }
      return false;
    }
    const previousLine = issueBodyLines[lineIndex - 1];
    const nextLine = issueBodyLines[lineIndex + 1];
    return (
      getLineIsFromTable(previousLine) &&
      getLineIsFromTable(line) &&
      nextLine === ""
    );
  });
}

function dateToLocaleString(date, locale) {
  return date.toLocaleString(locale, { timeZone: "Europe/Amsterdam" });
}

function getStartOfTimeLogEntry(timeLogEntry) {
  const startPattern = /(?<=\| )[^\|]+(?= \|)/;
  const startMatches = timeLogEntry.match(startPattern);
  if (startMatches === null) {
    throw new Error("No start match found in time log entry: " + timeLogEntry);
  }
  return startMatches[0];
}

function joinLines(lines) {
  return lines.join("\n");
}

const LOCALE = "sv-SE"; // YYYY-MM-DD HH:MM:SS format

// --- Add time log ---

function addTimeLog(issueBodyLines, locale) {
  const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);

  const now = new Date();
  const nowString = dateToLocaleString(now, locale);
  const startString = nowString;
  const newEntry = `| ${startString} |                     |          |`;

  return issueBodyLines.toSpliced(lineIndexOfLastEntry + 1, 0, newEntry);
}

// --- Complete time log ---

function completeLastTimeLog(issueBodyLines, locale) {
  const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);
  const lastEntry = issueBodyLines[lineIndexOfLastEntry];

  const now = new Date();
  const nowString = dateToLocaleString(now, locale);
  const endString = nowString;
  const end = now;

  const startString = getStartOfTimeLogEntry(lastEntry);
  const startWithTimeZoneOffset = new Date(startString);
  const timeZoneOffset = new Date(nowString) - now;
  const start = new Date(startWithTimeZoneOffset - timeZoneOffset);

  const duration = new Date(end - start);
  const durationString = duration.toLocaleTimeString(locale, {
    timeZone: "UTC",
  });

  const updatedValuesPattern = /(?<=\| .+ \| )[^\|]+(?= \|)/g;
  const updatedValues = [endString, durationString];
  let updatedValuesCounter = 0;
  issueBodyLines[lineIndexOfLastEntry] = lastEntry.replace(
    updatedValuesPattern,
    () => updatedValues[updatedValuesCounter++]
  );

  return issueBodyLines;
}

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

const now = new Date();
const locale = "sv-SE"; // YYYY-MM-DD HH:MM:SS format
const nowString = now.toLocaleString(locale, { timeZone: "Europe/Amsterdam" });

// --- Add time log ---

const startString = nowString;
const newEntry = `| ${startString} |                     |          |`;
const lastTableCharacterPattern = /(?<=## Time log.+\|)\n(?!\|)/s;
const updatedIssueBody = context.payload.issue.body.replace(
  lastTableCharacterPattern,
  (match) => match + newEntry + "\n"
);

await github.rest.issues.update({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: context.payload.issue.number,
  body: updatedIssueBody,
});

// --- Complete time log ---

const issueBody = context.payload.issue.body;
const issueBodyLines = splitLines(issueBody);

const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);
const lastEntry = issueBodyLines[lineIndexOfLastEntry];

const endString = nowString;

const startString = getStartOfTimeLogEntry(lastEntry);
const startWithTimeZoneOffset = new Date(startString);
const timeZoneOffset = new Date(nowString) - now;
const start = new Date(startWithTimeZoneOffset - timeZoneOffset);

const end = now;
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

const updatedIssueBody = joinLines(issueBodyLines);

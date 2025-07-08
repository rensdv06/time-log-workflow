// --- General ---

const now = new Date();
const locale = "sv-SE"; // YYYY-MM-DD HH:MM:SS format
const nowString = now.toLocaleString(locale, { timeZone: "Europe/Amsterdam" });

const latestEntryPattern = /(?<=## Time log\n[\s\S]*)(?<=\| ).+(?= \|\n(?!\|))/;

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

const latestEntryMatches = issueBody.match(latestEntryPattern);
if (latestEntryMatches === null) {
  throw new Error("No latest entry match found in issue body:\n" + issueBody);
}

const latestEntry = latestEntryMatches[0];
const ENTRY_VALUES_SEPARATOR = " | ";
const latestEntryValues = latestEntry.split(ENTRY_VALUES_SEPARATOR);
const startString = latestEntryValues[0];

const startWithTimeZoneOffset = new Date(startString);
const timeZoneOffset = new Date(nowString) - now;
const start = new Date(startWithTimeZoneOffset - timeZoneOffset);

const end = now;
const duration = new Date(end - start);
const durationString = duration.toLocaleTimeString(locale, {
  timeZone: "UTC",
});

const endString = nowString;
const updatedLatestEntryValues = [startString, endString, durationString];
const updatedLatestEntry = updatedLatestEntryValues.join(
  ENTRY_VALUES_SEPARATOR
);

const updatedIssueBody = issueBody.replace(
  latestEntryPattern,
  updatedLatestEntry
);

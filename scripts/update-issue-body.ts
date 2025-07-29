import { GitHub } from "@actions/github/lib/utils";
import { Context } from "@actions/github/lib/context";
import * as core from "@actions/core";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

type GitHub = InstanceType<typeof GitHub>;
type Core = typeof core;
type Repo = Context["repo"];

type PartiallyRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

function getLineIsFromTable(line: string) {
  return /\|.+\|/.test(line);
}

function getLineIndexOfLastEntry(issueBodyLines: string[]) {
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

function dateToString(
  date: Date,
  options: Intl.DateTimeFormatOptions = {},
  { timeOnly = false } = {}
) {
  // YYYY-MM-DD HH:mm:ss format
  // Must be a locale that uses a valid format for the Date constructor
  const LOCALE = "sv-SE";
  options = { timeZone: "Europe/Amsterdam", ...options };
  return !timeOnly
    ? date.toLocaleString(LOCALE, options)
    : date.toLocaleTimeString(LOCALE, options);
}

function addNewEntry(issueBodyLines: string[]) {
  const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);

  const now = new Date();
  const nowString = dateToString(now);

  const startString = nowString;
  const newEntry = `| ${startString} |                     |          |         |`;

  return issueBodyLines.toSpliced(lineIndexOfLastEntry + 1, 0, newEntry);
}

function removeMilliseconds(date: Date) {
  date.setMilliseconds(0);
  return date;
}

function getStartStringFromEntry(entry: string) {
  const startPattern = /(?<=\| )[^\|]+(?= \|)/;
  const startMatches = entry.match(startPattern);
  if (startMatches === null) {
    throw new Error("No start match found in entry: " + entry);
  }
  return startMatches[0];
}

function dateStringToDate(dateString: string) {
  const dateWithTimeZoneOffset = new Date(dateString);
  const timestampWithTimeZoneOffset = dateWithTimeZoneOffset.getTime();

  const now = removeMilliseconds(new Date());
  const nowString = dateToString(now);

  const nowWithTimeZoneOffset = new Date(nowString);
  const timeZoneOffset = nowWithTimeZoneOffset.getTime() - now.getTime();

  return new Date(timestampWithTimeZoneOffset - timeZoneOffset);
}

function getDuration(end: Date, start: Date) {
  const endTimestamp = end.getTime();
  const startTimestamp = start.getTime();
  return new Date(endTimestamp - startTimestamp);
}

function setDurationMinutesOutput(duration: Date, core: Core) {
  const durationMilliseconds = duration.getTime();
  const durationMinutes = Math.round(durationMilliseconds / 1000 / 60);
  core.setOutput("duration_minutes", durationMinutes);
}

async function getBranches(github: GitHub, repo: Repo) {
  const response = await github.rest.repos.listBranches({ ...repo });
  return response.data.map((branch) => branch.name);
}

async function getIssueBranch(github: GitHub, repo: Repo, issueNumber: number) {
  const branches = await getBranches(github, repo);
  const issueBranch = branches.find((branch) =>
    branch.startsWith(issueNumber + "-")
  );

  if (issueBranch === undefined) {
    console.warn(
      `No issue branch found for issue with number ${issueNumber} in branches ${JSON.stringify(
        branches
      )}`
    );
  }
  return issueBranch;
}

function dateStringToIsoString(dateString: string) {
  const date = dateStringToDate(dateString);
  return date.toISOString().split(".")[0] + "Z";
}

async function getCommitsBetweenDates(
  github: GitHub,
  {
    since,
    until,
    ...parameters
  }: PartiallyRequired<
    RestEndpointMethodTypes["repos"]["listCommits"]["parameters"],
    "since" | "until"
  >
) {
  const sinceIsoString = dateStringToIsoString(since);
  const untilIsoString = dateStringToIsoString(until);

  const response = await github.rest.repos.listCommits({
    ...parameters,
    since: sinceIsoString,
    until: untilIsoString,
  });
  return response.data.reverse(); // oldest first
}

function commitsToHashesString(commits: Commit[]) {
  const hashes = commits.map((commit) => commit.sha.slice(0, 7));
  return hashes.join(" ");
}

function stringReplaceWithMultipleValues(
  string: string,
  searchValue: string | RegExp,
  replaceValues: string[]
) {
  let replacedValuesCounter = 0;
  return string.replace(
    searchValue,
    () => replaceValues[replacedValuesCounter++]
  );
}

interface Commit {
  sha: string;
}

async function completeLastEntry(
  issueBodyLines: string[],
  core: Core,
  getCommits: (since: string, until: string) => Promise<Commit[]>
) {
  const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);
  const lastEntry = issueBodyLines[lineIndexOfLastEntry];

  const now = removeMilliseconds(new Date());
  const nowString = dateToString(now);

  const endString = nowString;
  const end = now;

  const startString = getStartStringFromEntry(lastEntry);
  const start = dateStringToDate(startString);

  const duration = getDuration(end, start);
  setDurationMinutesOutput(duration, core);
  const durationString = dateToString(
    duration,
    { timeZone: "UTC" },
    { timeOnly: true }
  );

  const commits = await getCommits(startString, endString);
  const commitsString = commitsToHashesString(commits);

  const valuesToUpdatePattern = /(?<=\| .+ \| )[^\|]+(?= \|)/g;
  const updatedValues = [endString, durationString, commitsString];
  issueBodyLines[lineIndexOfLastEntry] = stringReplaceWithMultipleValues(
    lastEntry,
    valuesToUpdatePattern,
    updatedValues
  );

  return issueBodyLines;
}

async function main(github: GitHub, context: Context, core: Core) {
  const eventAction = context.payload.action;
  const issue = context.payload.issue!;
  const issueBodyLines = issue.body!.split("\n");
  const repo = context.repo;

  let updatedIssueBodyLines: string[];
  if (eventAction === "labeled") {
    updatedIssueBodyLines = addNewEntry(issueBodyLines);
  } else if (eventAction === "unlabeled") {
    updatedIssueBodyLines = await completeLastEntry(
      issueBodyLines,
      core,
      async (since, until) => {
        const issueBranch = await getIssueBranch(github, repo, issue.number);
        return issueBranch !== undefined
          ? getCommitsBetweenDates(github, {
              ...repo,
              author: context.payload.sender!.login,
              sha: issueBranch,
              since,
              until,
            })
          : [];
      }
    );
  } else {
    throw new Error("Unknown value of eventAction: " + eventAction);
  }

  const updatedIssueBody = updatedIssueBodyLines.join("\n");
  github.rest.issues.update({
    ...repo,
    issue_number: issue.number,
    body: updatedIssueBody,
  });
}

module.exports = main;

import { GitHub } from "@actions/github/lib/utils";
import { Context } from "@actions/github/lib/context";
import * as core from "@actions/core";

type GitHub = InstanceType<typeof GitHub>;
type Core = typeof core;

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

function dateToLocaleString(date: Date, locale: Intl.LocalesArgument) {
  return date.toLocaleString(locale, { timeZone: "Europe/Amsterdam" });
}

function addNewEntry(issueBodyLines: string[], locale: Intl.LocalesArgument) {
  const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);

  const now = new Date();
  const nowString = dateToLocaleString(now, locale);
  const startString = nowString;
  const newEntry = `| ${startString} |                     |          |         |`;

  return issueBodyLines.toSpliced(lineIndexOfLastEntry + 1, 0, newEntry);
}

function dateStringToIsoString(dateString: string) {
  return dateString.replace(" ", "T") + "Z";
}

async function getCommitsBetweenDates(
  github: GitHub,
  repo: Context["repo"],
  sinceString: string,
  untilString: string
) {
  const sinceIsoString = dateStringToIsoString(sinceString);
  const untilIsoString = dateStringToIsoString(untilString);

  const response = await github.rest.repos.listCommits({
    owner: repo.owner,
    repo: repo.repo,
    since: sinceIsoString,
    until: untilIsoString,
  });
  return response.data;
}

function getStartStringFromEntry(entry: string) {
  const startPattern = /(?<=\| )[^\|]+(?= \|)/;
  const startMatches = entry.match(startPattern);
  if (startMatches === null) {
    throw new Error("No start match found in entry: " + entry);
  }
  return startMatches[0];
}

function dateStringToDate(dateString: string, nowString: string, now: Date) {
  const dateWithTimeZoneOffset = new Date(dateString);
  const timestampWithTimeZoneOffset = dateWithTimeZoneOffset.getTime();

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

function getCommitHashesWithUrlString(commits: Commit[]) {
  const commitHashesWithUrl = commits.map(
    (commit) => `[${commit.sha.slice(0, 7)}](${commit.html_url})`
  );
  return commitHashesWithUrl.join(" ");
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
  html_url: string;
}

async function completeLastEntry(
  issueBodyLines: string[],
  locale: Intl.LocalesArgument,
  core: Core,
  getCommits: (since: string, until: string) => Promise<Commit[]>
) {
  const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);
  const lastEntry = issueBodyLines[lineIndexOfLastEntry];

  const now = new Date();
  const nowString = dateToLocaleString(now, locale);

  const endString = nowString;
  const end = now;

  const startString = getStartStringFromEntry(lastEntry);
  const start = dateStringToDate(startString, nowString, now);

  const duration = getDuration(end, start);
  setDurationMinutesOutput(duration, core);
  const durationString = duration.toLocaleTimeString(locale, {
    timeZone: "UTC",
  });

  const commits = await getCommits(startString, endString);
  const commitsString = getCommitHashesWithUrlString(commits);

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
  const issue = context.payload.issue!;
  const issueBodyLines = issue.body!.split("\n");
  const LOCALE = "sv-SE"; // YYYY-MM-DD HH:MM:SS format

  const eventAction = context.payload.action;
  let updatedIssueBodyLines: string[];
  if (eventAction === "labeled") {
    updatedIssueBodyLines = addNewEntry(issueBodyLines, LOCALE);
  } else if (eventAction === "unlabeled") {
    updatedIssueBodyLines = await completeLastEntry(
      issueBodyLines,
      LOCALE,
      core,
      (since, until) =>
        getCommitsBetweenDates(github, context.repo, since, until)
    );
  } else {
    throw new Error("Unknown value of eventAction: " + eventAction);
  }

  const updatedIssueBody = updatedIssueBodyLines.join("\n");
  github.rest.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issue.number,
    body: updatedIssueBody,
  });
}

module.exports = main;

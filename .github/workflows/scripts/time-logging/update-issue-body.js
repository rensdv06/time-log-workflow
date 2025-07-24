"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        return (getLineIsFromTable(previousLine) &&
            getLineIsFromTable(line) &&
            nextLine === "");
    });
}
function dateToString(date, options = {}, { timeOnly = false } = {}) {
    // YYYY-MM-DD HH:mm:ss format
    // Must be a locale that uses a valid format for the Date constructor
    const LOCALE = "sv-SE";
    options = { timeZone: "Europe/Amsterdam", ...options };
    return !timeOnly
        ? date.toLocaleString(LOCALE, options)
        : date.toLocaleTimeString(LOCALE, options);
}
function addNewEntry(issueBodyLines) {
    const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);
    const now = new Date();
    const nowString = dateToString(now);
    const startString = nowString;
    const newEntry = `| ${startString} |                     |          |         |`;
    return issueBodyLines.toSpliced(lineIndexOfLastEntry + 1, 0, newEntry);
}
function removeMilliseconds(date) {
    date.setMilliseconds(0);
    return date;
}
function getStartStringFromEntry(entry) {
    const startPattern = /(?<=\| )[^\|]+(?= \|)/;
    const startMatches = entry.match(startPattern);
    if (startMatches === null) {
        throw new Error("No start match found in entry: " + entry);
    }
    return startMatches[0];
}
function dateStringToDate(dateString) {
    const dateWithTimeZoneOffset = new Date(dateString);
    const timestampWithTimeZoneOffset = dateWithTimeZoneOffset.getTime();
    const now = removeMilliseconds(new Date());
    const nowString = dateToString(now);
    const nowWithTimeZoneOffset = new Date(nowString);
    const timeZoneOffset = nowWithTimeZoneOffset.getTime() - now.getTime();
    return new Date(timestampWithTimeZoneOffset - timeZoneOffset);
}
function getDuration(end, start) {
    const endTimestamp = end.getTime();
    const startTimestamp = start.getTime();
    return new Date(endTimestamp - startTimestamp);
}
function setDurationMinutesOutput(duration, core) {
    const durationMilliseconds = duration.getTime();
    const durationMinutes = Math.round(durationMilliseconds / 1000 / 60);
    core.setOutput("duration_minutes", durationMinutes);
}
function dateStringToIsoString(dateString) {
    const date = dateStringToDate(dateString);
    return date.toISOString().split(".")[0] + "Z";
}
async function getCommitsBetweenDates(github, repo, sinceString, untilString) {
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
function commitsToHashesString(commits) {
    const hashes = commits.map((commit) => commit.sha.slice(0, 7));
    return hashes.join(" ");
}
function stringReplaceWithMultipleValues(string, searchValue, replaceValues) {
    let replacedValuesCounter = 0;
    return string.replace(searchValue, () => replaceValues[replacedValuesCounter++]);
}
async function completeLastEntry(issueBodyLines, core, getCommits) {
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
    const durationString = dateToString(duration, { timeZone: "UTC" }, { timeOnly: true });
    const commits = await getCommits(startString, endString);
    const commitsString = commitsToHashesString(commits);
    const valuesToUpdatePattern = /(?<=\| .+ \| )[^\|]+(?= \|)/g;
    const updatedValues = [endString, durationString, commitsString];
    issueBodyLines[lineIndexOfLastEntry] = stringReplaceWithMultipleValues(lastEntry, valuesToUpdatePattern, updatedValues);
    return issueBodyLines;
}
async function main(github, context, core) {
    const eventAction = context.payload.action;
    const issue = context.payload.issue;
    const issueBodyLines = issue.body.split("\n");
    let updatedIssueBodyLines;
    if (eventAction === "labeled") {
        updatedIssueBodyLines = addNewEntry(issueBodyLines);
    }
    else if (eventAction === "unlabeled") {
        updatedIssueBodyLines = await completeLastEntry(issueBodyLines, core, (since, until) => getCommitsBetweenDates(github, context.repo, since, until));
    }
    else {
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

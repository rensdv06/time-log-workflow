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
function dateStringToDate(dateString, nowString, now) {
    const dateWithTimeZoneOffset = new Date(dateString);
    const timestampWithTimeZoneOffset = dateWithTimeZoneOffset.getTime();
    const nowWithTimeZoneOffset = new Date(nowString);
    const timeZoneOffset = nowWithTimeZoneOffset.getTime() - now.getTime();
    return new Date(timestampWithTimeZoneOffset - timeZoneOffset);
}
function stringReplaceWithMultipleValues(string, searchValue, replaceValues) {
    let replacedValuesCounter = 0;
    return string.replace(searchValue, () => replaceValues[replacedValuesCounter++]);
}
function addTimeLog(issueBodyLines, locale) {
    const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);
    const now = new Date();
    const nowString = dateToLocaleString(now, locale);
    const startString = nowString;
    const newEntry = `| ${startString} |                     |          |`;
    return issueBodyLines.toSpliced(lineIndexOfLastEntry + 1, 0, newEntry);
}
function completeLastTimeLog(issueBodyLines, locale) {
    const lineIndexOfLastEntry = getLineIndexOfLastEntry(issueBodyLines);
    const lastEntry = issueBodyLines[lineIndexOfLastEntry];
    const now = new Date();
    const nowString = dateToLocaleString(now, locale);
    const endString = nowString;
    const end = now;
    const endTimestamp = end.getTime();
    const startString = getStartOfTimeLogEntry(lastEntry);
    const start = dateStringToDate(startString, nowString, now);
    const startTimestamp = start.getTime();
    const duration = new Date(endTimestamp - startTimestamp);
    const durationString = duration.toLocaleTimeString(locale, {
        timeZone: "UTC",
    });
    const updatedValuesPattern = /(?<=\| .+ \| )[^\|]+(?= \|)/g;
    const updatedValues = [endString, durationString];
    issueBodyLines[lineIndexOfLastEntry] = stringReplaceWithMultipleValues(lastEntry, updatedValuesPattern, updatedValues);
    return issueBodyLines;
}
function main(github, context) {
    const issue = context.payload.issue;
    const issueBodyLines = issue.body.split("\n");
    const LOCALE = "sv-SE"; // YYYY-MM-DD HH:MM:SS format
    const eventAction = context.payload.action;
    let updatedIssueBodyLines;
    if (eventAction === "labeled") {
        updatedIssueBodyLines = addTimeLog(issueBodyLines, LOCALE);
    }
    else if (eventAction === "unlabeled") {
        updatedIssueBodyLines = completeLastTimeLog(issueBodyLines, LOCALE);
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

# time-log-workflow

A GitHub actions workflow to automatically log time spent on issues in their descriptions and project items by toggling a label.

> [!TIP]
> Take a look ahead at [usage](#usage) to get an idea of how it works.

> [!TIP]
> Check out the [issue description example](issue-descriptions/issue-description-example.md) to get an idea of what an issue description might look like when using this workflow. Just keep in mind that the commit hash doesn't have a link here — GitHub only adds that once it's actually in an issue description.

## Purpose

The purpose of this workflow is to gain insight into the time spent and the time remaining on issues. This helps you to identify delays or leads in a timely manner, making it easier to make better decisions on how to handle them.

## How to use this workflow in your own project

The time log table functionality is the core of this workflow. You can choose to add the project item functionality on top of that. If you:

- ❌ Don’t want that, follow the additional points and steps marked with "(T)".
- ✅ Do want that, follow the additional points and steps marked with "(P)".

> [!NOTE]
> The points and steps below use the default names for everything. In case you'd like to change one, see [configuration](#configuration).

### Prerequisites

- You'll need to have this repository cloned in order to make changes and easily copy files.
- You'll need another GitHub repository with write access to use this workflow in.
- (P) That repository must be linked to a GitHub project that you also have write access to.
- (P) All issues you want to use this workflow for must be added to that project.

### Setup

1. Copy the contents of the [workflows folder](.github/workflows/) to `.github/workflows/` in your repository.
2. Choose an existing label or create a new one to trigger the workflow. It must be named "in progress".
3. Add the [time log section](issue-descriptions/time-log-section-template.md) to the descriptions of the issues where you'd like to use this workflow.
4. Set the time zone in which dates and times should be noted and interpreted. This can be done in the `options` object of `dateToString(...)` in [`update-issue-body.js`](.github/workflows/scripts/time-logging/update-issue-body.js). Must be an IANA time zone name. The default is `Europe/Amsterdam`. See [the reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#timezone) or [this list of time zones](https://data.iana.org/time-zones/tzdb-2021a/zone1970.tab) for more information.
5. (T) Remove the line `environment: time-logging` from the [workflow file](.github/workflows/time-logging.yml).
6. (T) Remove the step "Update time remaining in project item" from the [workflow file](.github/workflows/time-logging.yml).
7. (T) Optionally remove [`update-time-remaining.js`](.github/workflows/scripts/time-logging/update-time-remaining.js).
8. (P) Create an environment in your repository to store secrets and variables. Name it "time-logging".
9. (P) Generate a personal access token with the necessary scopes and/or permissions to read issues, project fields, and project items, and to write to project items. For a classic token, the "repo" and "project" scopes are sufficient.
10. (P) Add the personal access token as a secret in the environment. Name it "PERSONAL_ACCESS_TOKEN".
11. (P) Create custom number fields in your project for a time estimate and the time remaining (in minutes).
12. (P) Get the (node) IDs of these custom number fields. You can use the [shell script](scripts/get-project-fields.sh) for that:
    1. Find your project number. You can easily find it in the project URL. In the URL <https://github.com/users/rensdv06/projects/1>, for example, the project number is 1.
    2. Run the [script](scripts/get-project-fields.sh). If you're on Windows, you'll have to use a Unix-like shell such as Git Bash.
    3. Enter your personal access token, username, and project number.
    4. The script will return details for the first 20 project fields. Keep note of the "id" values for the time estimate and time remaining fields.
13. (P) Add these field IDs as variables in the environment. Name them "TIME_ESTIMATE_FIELD_ID" and "TIME_REMAINING_FIELD_ID".
14. Commit and push the added files to bring the workflow to GitHub.

> [!TIP]
> Copy the [time log section template](issue-descriptions/time-log-section-template.md) to an issue template on GitHub to have the option to automatically include the time log section in new issues.

### Usage

1. Add the "in progress" label to the issue you're going to work on.
2. The workflow will be triggered and will add a new row with your start time to the time log table in the issue description.
3. Create a branch and checkout to it to work on the issue. The branch name must start with the issue number, followed by a hyphen (-).
4. Publish the issue branch to GitHub.
5. Start working on the issue and maybe make a few commits.
6. Remove the label from the issue when you're done.
7. The workflow will be triggered again and will update the last row of the time log table with your end time, the duration, and links to the commits you made on the issue branch in the meantime.
8. (P) The duration in minutes will be subtracted from the value of the time remaining field of the project item. If that field has no value, the value of the time estimate field will be used instead. If that also has no value, nothing will be changed.

## Configuration

Simple changes to the workflow, like renaming the trigger label or the environment name, can be made by directly editing the [workflow file](.github/workflows/time-logging.yml).

For more complex changes, like changing the trigger or adding a new step, you have 2 options:

- Either change one of the JS scripts in the [workflow scripts folder](.github/workflows/scripts/time-logging/) directly;
- Or change the TypeScript equivalent in the [scripts folder](scripts). See [development](#development) for more information on how to do this.

There’s no separate config file like a `.env`. Any variables and secrets are stored in a GitHub environment, as explained in [setup](#setup).

## Development

First, run `npm install` to install the necessary dependencies.

When you've made changes to a TS script, run `npm run build` to compile all TS scripts to JS scripts in the [workflow scripts folder](.github/workflows/scripts/time-logging/). Alternatively, run `npm run dev` to automatically compile when a TS script changes.

If you'd like to commit your changes, you should commit both the TS and the JS scripts. This is because the workflow doesn't compile the TS scripts from source: it directly uses the JS scripts.

## Design choices

- My original idea was to trigger the workflow based on changes to the status of a project item. However, this event isn't listed in the [events that trigger workflows](https://docs.github.com/en/actions/reference/events-that-trigger-workflows). It _is_ included in the [webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads#projects_v2_status_update), but it appears to be quite limited in possibilities. For example, it seems to be available for organizations only, and it only supports a limited set of statuses. The best alternative I could come up with was to use a label instead, which is the reason I went with that.
  - If the project item status trigger becomes fully supported in the future, I might change the trigger to that myself. You're also welcome to [open an issue](https://github.com/rensdv06/time-log-workflow/issues/new) to let me know when it's available, or [submit a pull request](https://github.com/rensdv06/time-log-workflow/compare) with your own implementation.
- Although this project is officially a Node.js project, you don't actually need Node.js or npm yourself to use the workflow. The only reason it's a Node.js project is because TypeScript and its types are required for development. This means the project has zero runtime dependencies, which also means there's no need to run `npm ci` to use the workflow scripts. This is by design: it makes the workflow lightweight and therefore take less time to run.
- The format used for dates, times, and durations is the Swedish format for Sweden (sv-SE): `YYYY-MM-DD HH:mm:ss`. This closely resembles [JavaScript's official date time string format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format) (`YYYY-MM-DDTHH:mm:ss.sssZ`), which also happens to be the only format officially supported by the `Date` constructor. Since this constructor is used in the code to convert strings into `Date` objects — but readability also matters — this format was chosen as a good middle ground.
- The value of the time remaining field can go below zero. This is intentional: it indicates a backlog of the positive value of that number, in minutes.

## Contributing

Bugs and feature requests can be submitted by [opening an issue](https://github.com/rensdv06/time-log-workflow/issues/new). However, I'm not likely to implement feature requests if they don't benefit my own productivity. In that case, continue reading below.

Improvements and additions to this workflow are welcome and can be proposed by [opening a pull request](https://github.com/rensdv06/time-log-workflow/compare). If you don't want to integrate your changes in this repository, you can also make your own modified version by [creating a fork](https://github.com/rensdv06/time-log-workflow/fork).

## License

This project is licensed under the [MIT license](LICENSE.md).

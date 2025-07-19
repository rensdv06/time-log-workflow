"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function getItem(github, issueId) {
    const query = `
    query($issueId: ID!) {
      node(id: $issueId) {
        ... on Issue {
          projectItems(first: 1) {
            nodes {
              id,
              project {
                id
              }
            }
          }
        }
      }
    }
  `;
    const variables = { issueId };
    const response = await github.graphql(query, variables);
    return response.node.projectItems.nodes[0];
}
async function getItemNumberFieldNumber(github, itemId, numberFieldId) {
    const query = `
    query($itemId: ID!) {
      node(id: $itemId) {
        ... on ProjectV2Item {
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldNumberValue {
                number,
                field {
                  ... on ProjectV2FieldCommon {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
    const variables = { itemId };
    const response = await github.graphql(query, variables);
    const numberFieldsValues = response.node.fieldValues.nodes;
    const numberFieldValue = numberFieldsValues.find((numberFieldValues) => numberFieldValues.field !== undefined &&
        numberFieldValues.field.id === numberFieldId);
    return numberFieldValue?.number; // numberFieldValue is undefined when the number property is not set
}
async function setItemNumberFieldNumber(github, input) {
    const query = `
    mutation($input: UpdateProjectV2ItemFieldValueInput!) {
      updateProjectV2ItemFieldValue(input: $input) {
        projectV2Item {
          id
        }
      }
    }
  `;
    const variables = { input: { ...input, value: { number: input.value } } };
    await github.graphql(query, variables);
}
async function main(github, issueId, fieldIds, durationMinutes) {
    const item = await getItem(github, issueId);
    const { timeRemainingFieldId, timeEstimateFieldId } = fieldIds;
    const timeRemaining = (await getItemNumberFieldNumber(github, item.id, timeRemainingFieldId)) ??
        (await getItemNumberFieldNumber(github, item.id, timeEstimateFieldId));
    if (timeRemaining === undefined) {
        return;
    }
    const updatedTimeRemaining = timeRemaining - durationMinutes;
    const updateTimeRemainingInput = {
        projectId: item.project.id,
        itemId: item.id,
        fieldId: timeRemainingFieldId,
        value: updatedTimeRemaining,
    };
    setItemNumberFieldNumber(github, updateTimeRemainingInput);
}
module.exports = main;

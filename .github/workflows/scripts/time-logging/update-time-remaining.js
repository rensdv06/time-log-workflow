"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function getItemId(github, context) {
    const query = `
    query($issueId: ID!) {
      node(id: $issueId) {
        ... on Issue {
          projectItems(first: 1) {
            nodes {
              id
            }
          }
        }
      }
    }
  `;
    const variables = {
        issueId: context.payload.issue.node_id,
    };
    const response = await github.graphql(query, variables);
    return response.node.projectItems.nodes[0].id;
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
async function main(github, context, variables) {
    const itemId = await getItemId(github, context);
    const timeRemaining = (await getItemNumberFieldNumber(github, itemId, variables.timeRemainingFieldId)) ??
        (await getItemNumberFieldNumber(github, itemId, variables.timeEstimateFieldId));
    if (timeRemaining === undefined) {
        return;
    }
}
module.exports = main;

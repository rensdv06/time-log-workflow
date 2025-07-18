import { GitHub } from "@actions/github/lib/utils";
import { Context } from "@actions/github/lib/context";

type GitHub = InstanceType<typeof GitHub>;

interface ItemIdQueryResponse {
  node: {
    projectItems: {
      nodes: {
        id: string;
      }[];
    };
  };
}

async function getItemId(github: GitHub, context: Context) {
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
    issueId: context.payload.issue!.node_id,
  };
  const response = await github.graphql<ItemIdQueryResponse>(query, variables);
  return response.node.projectItems.nodes[0].id;
}

interface NumberFieldValuesQueryResponse {
  node: {
    fieldValues: {
      nodes: {
        number: number;
        field: {
          id: string;
        };
      }[];
    };
  };
}

async function getTimeRemaining(
  github: GitHub,
  itemId: string,
  timeRemainingFieldId: string
) {
  const query = `
    query($itemId: ID!) {
      node(id: $itemId) {
        ... on ProjectV2Item {
          fieldValues(first: 8) {
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
  const response = await github.graphql<NumberFieldValuesQueryResponse>(
    query,
    variables
  );

  const numberFieldsValues = response.node.fieldValues.nodes;
  const numberFieldValue = numberFieldsValues.find(
    (numberFieldValues) =>
      numberFieldValues.field !== undefined &&
      numberFieldValues.field.id === timeRemainingFieldId
  );
  return numberFieldValue!.number;
}

interface Variables {
  durationMinutes: number;
  timeRemainingFieldId: string;
}

async function main(github: GitHub, context: Context, variables: Variables) {
  const itemId = await getItemId(github, context);
  const timeRemaining = await getTimeRemaining(
    github,
    itemId,
    variables.timeRemainingFieldId
  );
}

module.exports = main;

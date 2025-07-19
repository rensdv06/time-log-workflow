import { GitHub } from "@actions/github/lib/utils";

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

async function getItemId(github: GitHub, issueId: string) {
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
  const variables = { issueId };
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

async function getItemNumberFieldNumber(
  github: GitHub,
  itemId: string,
  numberFieldId: string
) {
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
  const response = await github.graphql<NumberFieldValuesQueryResponse>(
    query,
    variables
  );

  const numberFieldsValues = response.node.fieldValues.nodes;
  const numberFieldValue = numberFieldsValues.find(
    (numberFieldValues) =>
      numberFieldValues.field !== undefined &&
      numberFieldValues.field.id === numberFieldId
  );
  return numberFieldValue?.number; // numberFieldValue is undefined when the number property is not set
}

interface FieldIds {
  timeEstimateFieldId: string;
  timeRemainingFieldId: string;
}

async function main(
  github: GitHub,
  issueId: string,
  fieldIds: FieldIds,
  durationMinutes: number
) {
  const itemId = await getItemId(github, issueId);
  const { timeRemainingFieldId, timeEstimateFieldId } = fieldIds;

  const timeRemaining =
    (await getItemNumberFieldNumber(github, itemId, timeRemainingFieldId)) ??
    (await getItemNumberFieldNumber(github, itemId, timeEstimateFieldId));
  if (timeRemaining === undefined) {
    return;
  }
}

module.exports = main;

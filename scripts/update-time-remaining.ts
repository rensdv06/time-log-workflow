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

async function main(github: GitHub, context: Context, durationMinutes: number) {
  const itemId = await getItemId(github, context);
}

module.exports = main;

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
async function main(github, context, durationMinutes) {
    const itemId = await getItemId(github, context);
}
module.exports = main;

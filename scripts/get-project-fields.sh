#!/bin/sh

read -p "Personal access token: " personal_access_token
read -p "Username: " username
read -p "Project number: " project_number

curl -X POST https://api.github.com/graphql \
  -H "Authorization: Bearer $personal_access_token" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"query(\$username: String!, \$projectNumber: Int!) {user(login: \$username) {projectV2(number: \$projectNumber) {fields(first: 20) {nodes {... on ProjectV2FieldCommon {id, name, dataType}}}}}}\",
    \"variables\": {
      \"username\": \"$username\",
      \"projectNumber\": $project_number
    }
  }"

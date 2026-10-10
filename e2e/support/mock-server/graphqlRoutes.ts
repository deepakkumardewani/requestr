import type { IncomingMessage } from "node:http";
import { buildSchema, graphql } from "graphql";

export const GRAPHQL_PATH = "/graphql";
const OPERATION_BAD_REQUEST = "BadRequest";
const OPERATION_FORCE_ERRORS = "ForceErrors";
const HEADER_FORCE_STATUS = "x-mock-status";
const HEADER_FORCE_ERRORS = "x-mock-errors";

const schema = buildSchema(`
  type User { id: ID!, name: String!, email: String }
  type Query {
    hello(name: String = "world"): String!
    user(id: ID!): User
    users(limit: Int): [User!]!
    headers: String!
  }
`);

const USERS = [
  { id: "1", name: "Ada", email: "ada@example.com" },
  { id: "2", name: "Linus", email: null },
];

function buildRoot(headers: IncomingMessage["headers"]) {
  return {
    hello: ({ name }: { name: string }) => `hello ${name}`,
    user: ({ id }: { id: string }) => USERS.find((u) => u.id === id) ?? null,
    users: ({ limit }: { limit?: number }) =>
      USERS.slice(0, limit ?? USERS.length),
    headers: () => JSON.stringify(headers),
  };
}

export interface GraphqlResult {
  status: number;
  body: unknown;
}

interface GraphqlPayload {
  query?: string;
  operationName?: string | null;
  variables?: Record<string, unknown> | null;
}

export async function executeGraphql(
  payload: GraphqlPayload,
  headers: IncomingMessage["headers"],
): Promise<GraphqlResult> {
  const forcedStatus = Number(headers[HEADER_FORCE_STATUS]);
  if (payload.operationName === OPERATION_BAD_REQUEST || forcedStatus === 400) {
    return {
      status: 400,
      body: { errors: [{ message: "Bad request (forced)" }] },
    };
  }
  if (
    payload.operationName === OPERATION_FORCE_ERRORS ||
    headers[HEADER_FORCE_ERRORS]
  ) {
    return {
      status: 200,
      body: { data: null, errors: [{ message: "Forced GraphQL error" }] },
    };
  }
  if (!payload.query) {
    return { status: 400, body: { errors: [{ message: "Missing query" }] } };
  }
  const result = await graphql({
    schema,
    source: payload.query,
    rootValue: buildRoot(headers),
    variableValues: payload.variables ?? undefined,
    operationName: payload.operationName ?? undefined,
  });
  return { status: 200, body: { ...result, extensions: { headers } } };
}

import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.query(
  "com.pdsmoover.backup.describeServer",
  {
    params: null,
    output: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
        estimatedBlobsSizeOnDisk: /*#__PURE__*/ v.integer(),
        estimatedReposSizeOnDisk: /*#__PURE__*/ v.integer(),
        lastBackupAt: /*#__PURE__*/ v.optional(
          /*#__PURE__*/ v.datetimeString(),
        ),
        nextBackupDueAt: /*#__PURE__*/ v.optional(
          /*#__PURE__*/ v.datetimeString(),
        ),
        /**
         * Some status are cached for a while to save on resources. This is the last time the status was updated.
         */
        statusLastUpdated: /*#__PURE__*/ v.datetimeString(),
        totalBlobs: /*#__PURE__*/ v.integer(),
        totalRepos: /*#__PURE__*/ v.integer(),
      }),
    },
  },
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params {}
export interface $output extends v.InferXRPCBodyInput<mainSchema["output"]> {}

declare module "@atcute/lexicons/ambient" {
  interface XRPCQueries {
    "com.pdsmoover.backup.describeServer": mainSchema;
  }
}

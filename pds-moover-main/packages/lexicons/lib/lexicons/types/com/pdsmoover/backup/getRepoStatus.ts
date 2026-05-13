import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.query(
  "com.pdsmoover.backup.getRepoStatus",
  {
    params: /*#__PURE__*/ v.object({
      /**
       * The DID of the repo.
       */
      did: /*#__PURE__*/ v.didString(),
    }),
    output: {
      type: "lex",
      schema: /*#__PURE__*/ v.object({
        active: /*#__PURE__*/ v.boolean(),
        /**
         * Optional field, the total number of blobs in the repo backup.
         */
        blobCount: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
        /**
         * Date the backups were created.
         */
        createdAt: /*#__PURE__*/ v.datetimeString(),
        did: /*#__PURE__*/ v.didString(),
        /**
         * Optional field, the current estimated size of the repo backup in bytes.
         */
        estimatedBackupSize: /*#__PURE__*/ v.optional(
          /*#__PURE__*/ v.integer(),
        ),
        /**
         * Date of the last backup.
         */
        lastBackup: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
        /**
         * Optional field, if set to zero no missing blobs were found. If set to a number greater than zero, the number of missing blobs found from a backup and getting 404 on getBlob..
         */
        missingBlobCount: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
        /**
         * Optional field, the current rev of the repo backup. If empty there's not a backup
         */
        rev: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.tidString()),
        /**
         * Optional field, the current PDS or PDS like source of the backup.
         */
        source: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
      }),
    },
  },
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema["params"]> {}
export interface $output extends v.InferXRPCBodyInput<mainSchema["output"]> {}

declare module "@atcute/lexicons/ambient" {
  interface XRPCQueries {
    "com.pdsmoover.backup.getRepoStatus": mainSchema;
  }
}

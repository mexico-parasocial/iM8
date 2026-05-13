# @pds-moover/moover

![cow](./images/moo.webp)

This is the core logic that runs [PDS MOOver](https://pdsmoover.com). With this you should be able to create your own
"PDS MOOver" without having
to figure out the atproto logic.

- [lib/atprotoUtils.js](./lib/atprotoUtils.js) - Helpers for atproto actions
- [Migrator](./lib/pdsmoover.js) - For handling regular migrations
- [BackupService](./lib/backup.js) - For signing up for backups, request a back up, and remove backups to a PDS MOOver
  instance
- [MissingBlobs](./lib/missingBlobs.js) - Finds missing blobs on your old PDS and uploads them to your new PDS
- [PlcOps](./lib/plc-ops.js) - Helpers for manual PCL operations
- [Restore](./lib/restore.js) - Handles a recovery and restores the at proto from the backup

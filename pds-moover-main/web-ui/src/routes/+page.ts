import {Client, ok, simpleFetchHandler} from '@atcute/client';
import {ComPdsmooverBackupDescribeServer} from '@pds-moover/lexicons';
import type {PageLoad} from './$types';
import {env} from '$env/dynamic/public';
import type {InferXRPCBodyOutput} from '@atcute/lexicons';

export const load: PageLoad = async () => {
    const handler = simpleFetchHandler({service: `https://${env.PUBLIC_XRPC_BASE}`});
    const rpc = new Client({handler});
    return await ok(
        //@ts-expect-error: says it's not assignable to never
        rpc.get('com.pdsmoover.backup.describeServer'),
    ) as InferXRPCBodyOutput<ComPdsmooverBackupDescribeServer.mainSchema['output']>

};

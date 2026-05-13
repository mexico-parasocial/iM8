import type {PageServerLoad} from './$types';
import {Client, simpleFetchHandler} from '@atcute/client';
import type {} from '@atcute/atproto';
import {env} from '$env/dynamic/private';

export const load: PageServerLoad = async ({params}) => {

    const allowedPds = env.PDS_AUTOFILL.split(',').sort();

    const defaultResponse = {
        pdsOptions: null,
        intinalDomain: null,
        allowedPds: allowedPds
    };

    if (!params.pds) {
        return defaultResponse;
    }

    if (!allowedPds.includes(params.pds.toLowerCase())) {
        console.error('PDS not allowed', params.pds);
        return defaultResponse;
    }

    try {
        const handler = simpleFetchHandler({service: `https://${params.pds}`});
        const rpc = new Client({handler});
        const {ok, data} = await rpc.get('com.atproto.server.describeServer', {})
        if (!ok) {
            console.error('Failed to describe the PDS server', data);
            return {pds: null, allowedPds};
        }
        return {
            pdsOptions: data,
            intinalDomain: data?.availableUserDomains[0] ?? '',
            allowedPds: allowedPds
        };
    } catch (e) {
        console.error('Failed to describe the PDS server', e);
        return defaultResponse;
    }
};

import type {PageServerLoad} from './$types';
import {env} from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
    const allowedPds = env.PDS_AUTOFILL.split(',').sort();

    return {
        allowedPds
    };
};

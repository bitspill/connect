/* @flow */
'use strict';

import AbstractMethod from './AbstractMethod';
import { validateParams } from './helpers/paramsValidator';

import * as UI from '../../constants/ui';
import { UiMessage } from '../../message/builder';
import DataManager from '../../data/DataManager';

import type { UiPromiseResponse } from 'flowtype';
import type { Identity, SignedIdentity } from '../../types/trezor';
import type { ConnectSettings } from '../../data/ConnectSettings';
import type { CoreMessage } from '../../types';
import type { RequestLogin$ } from '../../types/response';

type Params = {
    asyncChallenge: boolean,
    identity: Identity,
    challengeHidden: string,
    challengeVisual: string,
}

export default class RequestLogin extends AbstractMethod {
    params: Params;

    constructor(message: CoreMessage) {
        super(message);
        this.useEmptyPassphrase = true;
        this.requiredPermissions = ['read', 'write'];
        this.info = 'Login';

        const payload: Object = message.payload;

        const identity: Identity = { };
        const settings: ConnectSettings = DataManager.getSettings();
        if (settings.origin) {
            const uri: Array<string> = settings.origin.split(':');
            identity.proto = uri[0];
            identity.host = uri[1].substring(2);
            if (uri[2]) {
                identity.port = uri[2];
            }
            identity.index = 0;
        }

        // validate incoming parameters
        validateParams(payload, [
            { name: 'challengeHidden', type: 'string' },
            { name: 'challengeVisual', type: 'string' },
            { name: 'asyncChallenge', type: 'boolean' },
        ]);

        this.params = {
            asyncChallenge: payload.asyncChallenge,
            identity,
            challengeHidden: payload.challengeHidden || '',
            challengeVisual: payload.challengeVisual || '',
        };
    }

    async run(): Promise<$PropertyType<RequestLogin$, 'payload'>> {
        if (this.params.asyncChallenge) {
            // send request to developer
            this.postMessage(new UiMessage(UI.LOGIN_CHALLENGE_REQUEST));

            // wait for response from developer
            const uiResp: UiPromiseResponse = await this.createUiPromise(UI.LOGIN_CHALLENGE_RESPONSE, this.device).promise;
            const payload: Object = uiResp.payload;

            // validate incoming parameters
            validateParams(payload, [
                { name: 'challengeHidden', type: 'string', obligatory: true },
                { name: 'challengeVisual', type: 'string', obligatory: true },
            ]);

            this.params.challengeHidden = payload.challengeHidden;
            this.params.challengeVisual = payload.challengeVisual;
        }

        const response: SignedIdentity = await this.device.getCommands().signIdentity(
            this.params.identity,
            this.params.challengeHidden,
            this.params.challengeVisual
        );

        return {
            address: response.address,
            publicKey: response.public_key,
            signature: response.signature,
        }
    }
}

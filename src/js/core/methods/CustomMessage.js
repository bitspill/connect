/* @flow */
'use strict';

import AbstractMethod from './AbstractMethod';
import * as UI from '../../constants/ui';

import { UiMessage } from '../CoreMessage';
import type { UiPromiseResponse } from 'flowtype';
import type { CoreMessage } from '../../types';

type Params = {
    customMessages: JSON;
    message: string;
    params: any;
}

export default class CustomMessage extends AbstractMethod {

    params: Params;
    run: () => Promise<any>;

    constructor(message: CoreMessage) {
        super(message);
        this.requiredPermissions = ['custom-message'];
        this.requiredFirmware = '1.0.0';
        this.useDevice = true;
        this.useUi = true;
        this.info = 'Custom message';

        const payload: any = message.payload;

        if (payload.hasOwnProperty('messages')){
            try {
                JSON.parse( JSON.stringify(payload.messages) );
            } catch (error) {
                throw new Error('Parameter "messages" has invalid type. JSON expected.');
            }
        }

        if (typeof payload.message !== 'string') {
            throw new Error('Parameter "message" has invalid type. String expected.');
        }

        if (typeof payload.params !== 'object') {
            throw new Error('Parameter "params" has invalid type. Object expected.');
        }

        this.params = {
            customMessages: payload.messages,
            message: payload.message,
            params: payload.params
        }
    }

    getCustomMessages(): ?JSON {
        return this.params.customMessages;
    }

    async run(): Promise<Object> {

        // call message
        const response = await this.device.getCommands()._commonCall(this.params.message, this.params.params);

        // send result to developer
        this.postMessage(new UiMessage(UI.CUSTOM_MESSAGE_REQUEST, response));

        // wait for response from developer
        const uiResp: UiPromiseResponse = await this.createUiPromise(UI.CUSTOM_MESSAGE_RESPONSE, this.device).promise;
        const payload = uiResp.payload;

        // validate again
        if (typeof payload.message !== 'string') {
            throw new Error('Parameter "message" has invalid type. String expected.');
        }

        if (typeof payload.params !== 'object') {
            payload.params = {};
        }

        if (payload.message.toLowerCase() === 'release') {
            // release device
            return response;
        } else {
            // change local params and make another call to device
            this.params.message = payload.message;
            this.params.params = payload.params;
            return await this.run();
        }
    }
}
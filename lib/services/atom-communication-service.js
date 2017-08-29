'use babel';

import { CommunicationService } from 'chat-codes-services/built/communication-service';
import { ChatUserList, ChatUser } from 'chat-codes-services/built/chat-user';
import { PusherCommunicationLayer } from 'chat-codes-services/built/pusher-communication-layer';
import { MessageGroups, MessageGroup } from 'chat-codes-services/built/chat-messages';
import { AtomEditorWrapper } from './atom-editor-wrapper';

const _ = require('underscore');
const EventEmitter = require('events');
const CREDENTIALS = require('./pusher-credentials');

export class AtomCommunicationService extends EventEmitter {
    constructor(username) {
        super();
        this.commService = new CommunicationService(true, {
            username: username,
            key: CREDENTIALS.key,
            cluster: CREDENTIALS.cluster
        }, AtomEditorWrapper);

        this.channelServicePromise = this.commService.createChannel().then((channelService) => {
            this.channelService = channelService;

            this.channelService.on('members-changed', (e) => { this.emit('members-changed', e); });
            this.channelService.on('message', (e) => { this.emit('message', e); });
            this.channelService.on('typing-status', (e) => { this.emit('typing-status', e); });
            this.channelService.on('editor-event', (e) => { this.emit('editor-event', e); });
            this.channelService.on('cursor-event', (e) => { this.emit('cursor-event', e); });
            this.channelService.on('editor-state', (e) => { this.emit('editor-state', e); });
            this.channelService.on('editor-opened', (e) => { this.emit('editor-opened', e); });
            this.channelService.on('terminal-data', (e) => { this.emit('terminal-data', e); });


            this.userList = this.channelService.userList;
            this.messageGroups = this.channelService.messageGroups;

            return this.channelService;
        });
    }
    destroy() {
        this.channelService.destroy();
    }
    ready() { return this.channelServicePromise; };
    sendTextMessage(data) { this.channelService.sendTextMessage(data); };
    sendTypingStatus(data) { this.channelService.sendTypingStatus(data); };
    emitEditorChanged(data) { this.channelService.emitEditorChanged(data); };
    emitCursorPositionChanged(data) { this.channelService.emitCursorPositionChanged(data); };
    emitCursorSelectionChanged(data) { this.channelService.emitCursorSelectionChanged(data); };
    writeToTerminal(data) { this.channelService.writeToTerminal(data); };
    emitTerminalData(data) { this.channelService.emitTerminalData(data, false); };
}

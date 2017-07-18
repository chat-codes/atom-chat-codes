'use babel';

const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const url = require('url');

const WatchEditor = require('./watch-editor');

const {Range} = require('atom');

const DEBUG = true;

const EventEmitter = require('events');
const ChatUserList = require('./chat-user');
const PusherCommunicationLayer = require('./pusher-communication-layer');

const USE_PTY = true;

function generateChannelName(commLayer) {
    if(DEBUG) {
        return Promise.resolve('channel');
    } else {
        const WORD_FILE_NAME = 'google-10000-english-usa-no-swears-medium.txt'

        return new Promise(function(resolve, reject) {
            fs.readFile(path.join(__dirname, WORD_FILE_NAME), {encoding: 'utf-8'}, function(err, result) {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        }).then(function(words) {
            return _.shuffle(words.split(/\n/));
        }).then(function(wordList) {
            function* getNextWord() {
                for(var i = 0; i<wordList.length; i++) {
                    yield wordList[i];
                }
                var j = 0;
                while(true) {
                    yield j;
                    j++;
                }
            }

            function getNextAvailableName(iterator) {
                if(!iterator) {
                    var iterator = getNextWord();
                }
                const {value} = iterator.next();
                return commLayer.channelNameAvailable(value).then(function(available) {
                    if(available) {
                        return value;
                    } else {
                        return getNextAvailableName(iterator);
                    }
                });
            }

            return getNextAvailableName();
        });
    }
}

class ChatChannel extends EventEmitter {
    constructor(channelName, commLayer) {
        super();
        if(USE_PTY) {
            const pty = require('pty.js');
            this.term = pty.spawn('bash', [], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: process.env.HOME,
                env: process.env
            });
            this.term.on('data', (data) => {
                this.commLayer.trigger(this.channelName, 'terminal-data', {
                    timestamp: this.getTimestamp(),
                    remote: false,
                    data: data
                });
            });
        }
        this.commLayer = commLayer;

        this.channelName = channelName;
        this.editorWatcher = new WatchEditor();
        this.userList = new ChatUserList();

        this.messageHistory = [];

        this.editorWatcher.on('editor-event', (e) => {
            this.commLayer.trigger(this.channelName, 'editor-event', e);
        });
        this.editorWatcher.on('cursor-event', (e) => {
            this.commLayer.trigger(this.channelName, 'cursor-event', _.extend({
                uid: this.myID
            }, e));
        });
        this.editorWatcher.on('open-editor', (e) => {
            this.commLayer.trigger(this.channelName, 'editor-opened', e);
        });

        this.commLayer.channelReady(this.channelName).then(() => {
            this.editorWatcher.ready();
        });

        this.commLayer.bind(this.channelName, 'editor-event', (e) => {
            this.editorWatcher.handleDelta(_.extend(e, {
                user: this.userList.getUser(e.uid)
            }));
        });
        this.commLayer.bind(this.channelName, 'cursor-event', (e) => {
            this.editorWatcher.handleCursorEvent(_.extend(e, {
                user: this.userList.getUser(e.uid)
            }));
        });
        this.commLayer.bind(this.channelName, 'message', (data) => {
            this.messageHistory.push(data);
            this.emit('message', _.extend({
                sender: this.userList.getUser(data.uid)
            }, data));
        });
        this.commLayer.bind(this.channelName, 'typing', (data) => {
            const {uid, status} = data;
            const user = this.userList.getUser(uid);

            if(user) {
                user.setTypingStatus(status);

                this.emit('typing', _.extend({
                    user: user,
                }, data));
            }
        });
        this.commLayer.bind(this.channelName, 'write-to-terminal', (event) => {
            const {contents} = event;
            if(USE_PTY) {
                this.term.write(contents);
            }
        });

        this.commLayer.getMembers(this.channelName).then((memberInfo) => {
            this.myID = memberInfo.myID;
            this.userList.addAll(memberInfo);
        });

        this.commLayer.onMemberAdded(this.channelName, (member) => {
            this.userList.add(false, member.id, member.info.name);
            this.sendMessageHistory(member.id);
            this.commLayer.trigger(this.channelName, 'editor-state', {
                forUser: member.id,
                state: this.editorWatcher.serializeEditorStates()
            });
            // _.each(this.editorWatcher.serializeEditorStates(), (e) => {
            //     this.commLayer.trigger(this.channelName, 'editor-state', {
            //         forUser: member.id,
            //         state: e
            //     });
            // });
        });
        this.commLayer.onMemberRemoved(this.channelName, (member) => {
            this.editorWatcher.userRemoved(member.id);
            this.userList.remove(member.id);
        });
    }

    destroy() {
        this.editorWatcher.destroy();
        this.commLayer.trigger(this.channelName, 'disconnect', {});
        this.commLayer.unsubscribe(this.getName());
    }

    getName() {
        return this.channelName;
    }

    sendMessageHistory(forUser) {
        this.commLayer.trigger(this.channelName, 'message-history', {
            history: this.messageHistory,
            allUsers: this.userList.serialize(),
            forUser: forUser
        });
    }

    getURL() {
        return url.format({
            protocol: 'http',
            host: 'chat.codes',
            pathname: this.getName()
        });
    }

    postTextMessage(message) {
        const data = {
            uid: this.myID,
            type: 'text',
            message: message,
            timestamp: this.getTimestamp()
        };

        this.commLayer.trigger(this.channelName, 'message', data);
        this.emit('message', _.extend({
            sender: this.userList.getMe()
        }, data));
        this.messageHistory.push(data);
    }
    sendTypingStatus(status) {
        const data = {
            uid: this.myID,
            type: 'status',
            status: status,
            timestamp: this.getTimestamp()
        };
        const meUser = this.userList.getMe();

        this.commLayer.trigger(this.channelName, 'typing', data);
        this.emit('typingStatus', _.extend({
            sender: this.userList.getMe()
        }, data));

        if(meUser) {
            meUser.setTypingStatus(status);
        }
    }
    getTimestamp() {
        return (new Date()).getTime();
    }
}

export default class ChatService extends EventEmitter {
    constructor(username) {
        super();
        this.commLayer = new PusherCommunicationLayer({
            username: username
        });
        this.clients = {};
    }

    createChannel() {
        return generateChannelName(this.commLayer).then((channelName) => {
            var channel = new ChatChannel(channelName, this.commLayer);
            this.clients[channelName] = channel;
            return channel;
        });
    }

    destroyChannel(name) {
        if(this.clients[name]) {
            var client = this.clients[name]
            client.destroy();
            delete this.clients[name];
        }
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {}

    // Tear down any state and detach
    destroy() {
        this.commLayer.destroy();
    }
}
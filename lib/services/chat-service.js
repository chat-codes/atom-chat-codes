'use babel';

const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const url = require('url');

const WatchEditor = require('./watch-editor');
we = new WatchEditor();

const DEBUG = true;

const EventEmitter = require('events');
import Pusher from 'pusher-js';
const ChatUserList = require('./chat-user');

const key = "44f522b8df5a8a3ccf74"
const cluster = "us2"

function getAuthURL(userName) {
    return url.format({
        hostname: 'chat.codes',
        protocol: 'http',
        pathname: 'auth.php',
        query: { name: userName}
    });
}

function generateChannelName(socket) {
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
                return channelNameAvailable(value, socket).then(function(available) {
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

function channelNameAvailable(name, pusher) {
    return new Promise(function(resolve, reject) {
        var presenceChannel = pusher.subscribe('presence-'+name);
        var onReady = function(members) {
            var myID = members.myID;
            var anyOtherPeople = _.some(members.members, (memberInfo, id) => {
                return id !== myID;
            });
            // presenceChannel.disconnect();
            resolve(!anyOtherPeople);
        };
        presenceChannel.bind('pusher:subscription_error', (err) => {
            reject(err);
        });
        presenceChannel.bind('pusher:subscription_succeeded', (members) => {
            onReady(members);
        });
        if(presenceChannel.subscribed) {
            onReady(presenceChannel.members);
        }
    });
}

class ChatChannel extends EventEmitter {
    constructor(channelName, pusher) {
        super();
        this.pusher = pusher;
        this.channelName = channelName;
        this.userList = new ChatUserList();
        this.channel = this.pusher.subscribe('private-'+this.channelName);
        this.messageHistory = [];

    	this.channel.bind('client-message', (data) => {
            this.messageHistory.push(data);
            this.emit('message', _.extend({
                sender: this.userList.getUser(data.uid)
            }, data));
        });
    	this.channel.bind('client-typing', (data) => {
            const {uid, status} = data;
            const user = this.userList.getUser(uid);

            if(user) {
                user.setTypingStatus(status);
            }
        });

        this.presenceChannel = this.pusher.subscribe('presence-'+this.channelName);
        if(this.presenceChannel.subscribed) {
            this.userList.addAll(this.presenceChannel.members);
            this.myID = this.presenceChannel.members.myID;
        } else {
            this.presenceChannel.bind('pusher:subscription_succeeded', (members) => {
                this.myID = members.myID;
                this.userList.addAll(members);
            });
        }
        this.presenceChannel.bind('pusher:member_added', (member) => {
            this.userList.add(false, member.id, member.info.name);
            this.sendMessageHistory(member.id);
        });
        this.presenceChannel.bind('pusher:member_removed', (member) => {
            this.userList.remove(member.id);
        });
    }

    destroy() {
        this.channel.trigger('client-disconnect', {});
        this.channel.disconnect();
        this.pusher.unsubscribe(this.getName());
    }

    getName() {
        return this.channelName;
    }

    sendMessageHistory(forUser) {
        this.channel.trigger('client-message-history', {
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

        this.channel.trigger('client-message', data);
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

        this.channel.trigger('client-typing', data);
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
        this.pusher = new Pusher(key, {
            cluster: cluster,
    		authEndpoint: getAuthURL(username),
            encrypted: true
        });
        this.clients = {};
    }

    createChannel() {
        return generateChannelName(this.pusher).then((channelName) => {
            var channel = new ChatChannel(channelName, this.pusher);
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
        this.pusher.disconnect();
    }
}